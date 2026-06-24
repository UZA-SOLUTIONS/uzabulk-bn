/* eslint-disable no-console */
require("../utils/globals");

const mongoose = require("mongoose");
const { getMongoClientOptions } = require("../config/db");
const esHelper = require("../elasticsearch/esHelper");
const productIndex = require("../elasticsearch/indexes/productIndex");
const Product = require("../models/productsTable");
const { refreshElasticsearchAvailability } = require("../elasticsearch/availability");

const INDEX_ALIAS = "products";
const INDEX_PREFIX = "products_v2";
const BATCH_SIZE = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectMongoOnly = async (timeoutMs = 60000) => {
    if (mongoose.connection.readyState === 1) return;

    const mongoUri = process.env.MONGO_URI || process.env.MONGO_ATLAS_URI;
    if (!mongoUri) {
        throw new Error("MONGO_URI is missing.");
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (mongoose.connection.readyState === 1) return;
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(mongoUri, getMongoClientOptions());
            return;
        }
        await delay(200);
    }
    throw new Error("Timed out waiting for MongoDB connection.");
};

const buildIndexName = () =>
    `${INDEX_PREFIX}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${Date.now()}`;

const run = async () => {
    await connectMongoOnly();

    const targetIndex = buildIndexName();
    let indexed = 0;
    console.log(`Creating target index '${targetIndex}'...`);
    await esHelper.createIndex(targetIndex, productIndex.indexMapping);

    try {
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
            indexed += docs.length;
            page += 1;
            console.log(`Indexed batch ${page} (${docs.length} docs, ${indexed} total)`);
        }
    } finally {
        if (indexed > 0) {
            await esHelper.pointAliasToIndex(INDEX_ALIAS, targetIndex);
            console.log(`Alias '${INDEX_ALIAS}' -> '${targetIndex}' (${indexed} products)`);
            await refreshElasticsearchAvailability();
        } else {
            console.warn("No products indexed — alias left unchanged.");
        }
    }

    console.log("Reindex complete.");
};

run()
    .catch((error) => {
        console.error("reindexProductsEs failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        setTimeout(() => process.exit(), 100);
    });
