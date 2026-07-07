const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDatabase } = require("../config/db");
const esHelper = require("./esHelper");
const productIndex = require("./indexes/productIndex");
const Product = require("../models/productsTable");

const INDEX_ALIAS = "products";
const BATCH_SIZE = Number(process.env.ES_REINDEX_BATCH_SIZE) || 500;
const MONGO_RETRY_ATTEMPTS = 5;
const MONGO_RETRY_DELAY_MS = 3000;
const STATE_PATH = path.join(__dirname, "../scripts/.reindex-products-state.json");

const PRODUCT_SELECT =
    "name slug sku offerId short_description description status isFeatured bestSeller price average_rating sold_count date_created_utc date_modified_utc categories topCategoryId price_tiers featured_image";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readState = () => {
    try {
        if (!fs.existsSync(STATE_PATH)) return null;
        return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    } catch {
        return null;
    }
};

const writeState = (patch) => {
    const prev = readState() || {};
    const next = {
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
};

const ensureMongo = async (timeoutMs = 180000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await connectDatabase();
        } catch {
            // connectDatabase may reject while the shared db module schedules reconnect
        }
        if (mongoose.connection.readyState === 1) {
            await delay(400);
            if (mongoose.connection.readyState === 1) return;
        }
        await delay(MONGO_RETRY_DELAY_MS);
    }
    throw new Error("Timed out waiting for MongoDB connection.");
};

const inferLastIdFromEsCount = async (targetIndex, { log = console.log } = {}) => {
    const esCount = await esHelper.countDocuments(targetIndex);
    if (!esCount) {
        return { lastId: null, indexed: 0 };
    }

    await ensureMongo();
    const pivot = await Product.findOne({ status: "active" })
        .sort({ _id: 1 })
        .skip(Math.max(0, esCount - 1))
        .limit(1)
        .select("_id")
        .lean();

    const lastId = pivot?._id ? String(pivot._id) : null;
    if (lastId && log) {
        log(
            `Inferred resume cursor from ES count (${esCount} docs) -> Mongo _id > ${lastId}`
        );
    }
    return { lastId, indexed: esCount };
};

const withMongoRetry = async (label, fn) => {
    let lastError;
    for (let attempt = 1; attempt <= MONGO_RETRY_ATTEMPTS; attempt += 1) {
        try {
            await ensureMongo();
            return await fn();
        } catch (error) {
            lastError = error;
            const msg = error?.message || String(error);
            console.warn(`${label} failed (attempt ${attempt}/${MONGO_RETRY_ATTEMPTS}): ${msg}`);
            if (attempt < MONGO_RETRY_ATTEMPTS) {
                await delay(MONGO_RETRY_DELAY_MS * attempt);
            }
        }
    }
    throw lastError;
};

const fetchActiveBatch = async (lastId = null) => {
    const filter = { status: "active" };
    if (lastId) {
        filter._id = { $gt: lastId };
    }
    return Product.find(filter)
        .select(PRODUCT_SELECT)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();
};

const indexBatch = async (docs, targetIndex) => {
    if (!docs?.length) return;
    await productIndex.bulkInsert(docs, { index: targetIndex });
};

const countMongoActive = async () => {
    await ensureMongo();
    return Product.countDocuments({ status: "active" });
};

const runIncrementalSync = async ({ indexName = "", log = console.log } = {}) => {
    const prior = readState();
    const targetIndex = indexName || (await esHelper.getAliasTargetIndex(INDEX_ALIAS));
    if (!targetIndex) {
        throw new Error("No alias index found. Run a full reindex first.");
    }
    if (!(await esHelper.indexExists(targetIndex))) {
        throw new Error(`Index '${targetIndex}' does not exist.`);
    }

    log(`Incremental sync into '${targetIndex}' (alias '${INDEX_ALIAS}').`);

    let lastId = prior?.lastSyncedId || null;
    if (!lastId) {
        const inferred = await inferLastIdFromEsCount(targetIndex, { log });
        lastId = inferred.lastId;
    }
    let indexed = 0;
    let batch = 0;

    if (lastId) {
        log(`Syncing products with _id > ${lastId}`);
    }

    while (true) {
        const docs = await withMongoRetry("Mongo sync fetch", () => fetchActiveBatch(lastId));
        if (!docs.length) break;

        await indexBatch(docs, targetIndex);
        batch += 1;
        indexed += docs.length;
        lastId = String(docs[docs.length - 1]._id);
        log(`Synced batch ${batch} (${docs.length} docs, ${indexed} new)`);
    }

    const lastSyncAt = prior?.lastSyncAt ? new Date(prior.lastSyncAt) : null;
    if (lastSyncAt && !Number.isNaN(lastSyncAt.getTime())) {
        log(`Syncing products modified since ${lastSyncAt.toISOString()}`);
        let modifiedBatch = 0;
        let modifiedCursor = null;

        while (true) {
            const filter = {
                status: "active",
                date_modified_utc: { $gt: lastSyncAt },
            };
            if (modifiedCursor) {
                filter._id = { $gt: modifiedCursor };
            }

            const docs = await withMongoRetry("Mongo modified fetch", async () => {
                await ensureMongo();
                return Product.find(filter)
                    .select(PRODUCT_SELECT)
                    .sort({ _id: 1 })
                    .limit(BATCH_SIZE)
                    .lean();
            });

            if (!docs.length) break;

            await indexBatch(docs, targetIndex);
            modifiedBatch += 1;
            indexed += docs.length;
            modifiedCursor = String(docs[docs.length - 1]._id);
            log(`Updated batch ${modifiedBatch} (${docs.length} docs)`);
        }
    }

    const mongoTotal = await withMongoRetry("Mongo count", countMongoActive);
    const esTotal = await esHelper.countDocuments(targetIndex);
    log(`Mongo active: ${mongoTotal} | ES '${targetIndex}': ${esTotal}`);

    writeState({
        ...prior,
        mode: "sync",
        targetIndex,
        lastSyncedId: lastId || prior?.lastSyncedId || null,
        lastSyncAt: new Date().toISOString(),
        completed: true,
    });

    if (!indexed) {
        log("Sync complete — no new or updated products.");
    } else {
        log(`Sync complete — indexed/updated ${indexed} product(s).`);
    }

    return { indexed, mongoTotal, esTotal, targetIndex };
};

module.exports = {
    INDEX_ALIAS,
    BATCH_SIZE,
    STATE_PATH,
    PRODUCT_SELECT,
    delay,
    readState,
    writeState,
    ensureMongo,
    inferLastIdFromEsCount,
    withMongoRetry,
    fetchActiveBatch,
    indexBatch,
    countMongoActive,
    runIncrementalSync,
};
