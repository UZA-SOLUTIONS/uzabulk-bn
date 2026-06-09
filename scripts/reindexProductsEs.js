/* eslint-disable no-console */
require("../utils/globals");
require("../config/db");

const mongoose = require("mongoose");
const esHelper = require("../elasticsearch/esHelper");
const productIndex = require("../elasticsearch/indexes/productIndex");
const Product = require("../models/productsTable");

const INDEX_ALIAS = "products";
const INDEX_PREFIX = "products_v2";
const BATCH_SIZE = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDb = async (timeoutMs = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (mongoose.connection.readyState === 1) return;
        await delay(200);
    }
    throw new Error("Timed out waiting for MongoDB connection.");
};

const buildIndexName = () =>
    `${INDEX_PREFIX}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${Date.now()}`;

const run = async () => {
    await waitForDb();

    const targetIndex = buildIndexName();
    console.log(`Creating target index '${targetIndex}'...`);
    await esHelper.createIndex(targetIndex, productIndex.indexMapping);

    let page = 0;
    while (true) {
        const docs = await Product.find({ status: "active" })
            .select("name slug sku offerId short_description description status isFeatured bestSeller price average_rating sold_count date_created_utc categories price_tiers featured_image")
            .sort({ _id: 1 })
            .skip(page * BATCH_SIZE)
            .limit(BATCH_SIZE)
            .lean();
        if (!docs.length) break;
        await productIndex.bulkInsert(docs, { index: targetIndex });
        page += 1;
        console.log(`Indexed batch ${page} (${docs.length} docs)`);
    }

    await esHelper.pointAliasToIndex(INDEX_ALIAS, targetIndex);
    console.log(`Reindex complete. Alias '${INDEX_ALIAS}' -> '${targetIndex}'`);
};

run()
    .catch((error) => {
        console.error("reindexProductsEs failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        setTimeout(() => process.exit(), 100);
    });
