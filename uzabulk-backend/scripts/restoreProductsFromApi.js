/* eslint-disable no-console */
require("../utils/globals");
require("../config/db");

const mongoose = require("mongoose");
const { getProductDetail } = require("../modules/products/services/alibaba");
const { updateProductDetails } = require("../modules/products/helper/migration");

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_STORE_TYPE_ID = "660e3c271095513081ed2223";
const DEFAULT_VENDOR_ID = "6625f5426b433d206e538ec2";

const parseIntegerArg = (flag, fallback) => {
    const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    if (!raw) return fallback;
    const value = Number(raw.split("=")[1]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const parseOfferIdsArg = () => {
    const raw = process.argv.find((arg) => arg.startsWith("--offerIds="));
    if (!raw) return [];
    return raw
        .split("=")[1]
        .split(",")
        .map((value) => String(value || "").trim())
        .filter(Boolean);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDbAndModels = async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const isConnected = mongoose.connection.readyState === 1;
        const hasProductModel = Boolean(global._model?.Product);
        if (isConnected && hasProductModel) return;
        await delay(250);
    }

    throw new Error("Timed out waiting for MongoDB connection/models initialization.");
};

const runWithConcurrency = async (items, worker, concurrency) => {
    let index = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (index < items.length) {
            const currentIndex = index;
            index += 1;
            await worker(items[currentIndex], currentIndex);
        }
    });
    await Promise.all(workers);
};

const restoreSingleProduct = async (product, currentIndex, totalLabel, stats) => {
    try {
        const offerId = String(product.offerId || "").trim();
        if (!offerId) {
            stats.skipped += 1;
            return;
        }

        console.log(`[${currentIndex + 1}/${totalLabel}] Fetching offerId=${offerId}`);
        const details = await getProductDetail(offerId);
        if (!details) {
            stats.failed += 1;
            console.warn(`[${currentIndex + 1}/${totalLabel}] API returned empty for offerId=${offerId}`);
            return;
        }

        let sourceProduct = product;
        if (!product._id) {
            sourceProduct = await _model.Product.create({
                storeType: DEFAULT_STORE_TYPE_ID,
                vendor: DEFAULT_VENDOR_ID,
                name: details.subjectTrans || `Imported ${offerId}`,
                type: "simple",
                status: "inactive",
                offerId,
                adminSold: true,
                external: true,
            });
        }

        await updateProductDetails(sourceProduct, details);
        stats.success += 1;
    } catch (error) {
        stats.failed += 1;
        console.error(`Restore failed for product=${product._id} offerId=${product.offerId}:`, error.message);
    }
};

const restoreProducts = async () => {
    const limit = parseIntegerArg("--limit", 0);
    const skip = parseIntegerArg("--skip", 0);
    const concurrency = parseIntegerArg("--concurrency", DEFAULT_CONCURRENCY);
    const offerIdsArg = parseOfferIdsArg();

    await waitForDbAndModels();

    let products = [];
    const stats = {
        success: 0,
        failed: 0,
        skipped: 0,
    };

    if (offerIdsArg.length) {
        console.log(`Loading ${offerIdsArg.length} requested offer IDs from database...`);
        const foundProducts = await _model.Product.find({
            offerId: { $in: [...new Set(offerIdsArg)] },
        })
            .select("_id offerId vendor")
            .lean();

        const foundByOfferId = new Map(
            foundProducts.map((product) => [String(product.offerId), product])
        );

        products = offerIdsArg.map((offerId) => {
            if (foundByOfferId.has(offerId)) {
                return foundByOfferId.get(offerId);
            }
            return {
                _id: null,
                offerId,
                vendor: DEFAULT_VENDOR_ID,
            };
        });
    } else {
        const query = { offerId: { $exists: true, $ne: "" } };
        console.log("Streaming products with offerId from database...");
        if (limit <= 0) {
            console.log("No --limit provided, so this run will sync every product with an offerId.");
        } else {
            console.log(`Limit: ${limit}`);
        }

        const cursorQuery = _model.Product.find(query)
            .select("_id offerId vendor")
            .skip(skip)
            .sort({ _id: 1 })
            .lean();

        if (limit > 0) {
            cursorQuery.limit(limit);
        }

        const cursor = cursorQuery.cursor({ batchSize: 100 });
        const activeJobs = [];
        let queuedCount = 0;

        for await (const product of cursor) {
            const currentIndex = queuedCount;
            queuedCount += 1;
            const totalLabel = limit > 0 ? limit : "?";

            const job = restoreSingleProduct(product, currentIndex, totalLabel, stats)
                .finally(() => {
                    const jobIndex = activeJobs.indexOf(job);
                    if (jobIndex >= 0) activeJobs.splice(jobIndex, 1);
                });

            activeJobs.push(job);

            if (activeJobs.length >= concurrency) {
                await Promise.race(activeJobs);
            }
        }

        await Promise.all(activeJobs);

        if (!queuedCount) {
            console.log("No products found with offerId (and none passed in --offerIds). Nothing to restore.");
            return;
        }

        console.log(`Processed ${queuedCount} products from database stream.`);
        console.log("Restore complete.");
        console.log(`Success: ${stats.success}`);
        console.log(`Failed: ${stats.failed}`);
        console.log(`Skipped: ${stats.skipped}`);
        return;
    }

    console.log(`Loaded ${products.length} products for API sync.`);

    if (!products.length) {
        console.log("No products found with offerId (and none passed in --offerIds). Nothing to restore.");
        return;
    }

    console.log(`Restoring ${products.length} products from API to current database...`);

    await runWithConcurrency(
        products,
        (product, currentIndex) => restoreSingleProduct(product, currentIndex, products.length, stats),
        concurrency
    );

    console.log("Restore complete.");
    console.log(`Success: ${stats.success}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
};

const closeAndExit = async (code) => {
    try {
        await mongoose.connection.close();
    } catch (error) {
        console.error("Error closing DB connection:", error.message);
    }
    process.exit(code);
};

restoreProducts()
    .then(() => closeAndExit(0))
    .catch(async (error) => {
        console.error("Restore script failed:", error.message);
        await closeAndExit(1);
    });
