/* eslint-disable no-console */
/**
 * Nightly buyer-side AI catalog pipeline:
 *   1. Smart listing enrichment (VL → Max)
 *   2. Embedding backfill (batched — safe at large catalog scale)
 *   3. Related products pre-compute
 *
 *   npm run catalog-ai:nightly
 *   npm run catalog-ai:nightly -- --limit=50 --force
 */
require("../utils/globals");
const mongoose = require("mongoose");
const { connectDatabase } = require("../config/db");
const { backfillAutoSmartListing } = require("../modules/ai/services/autoSmartListingService");
const { backfillProductEmbeddings } = require("../modules/products/services/similarProductsService");
const { backfillRelatedProducts } = require("../modules/products/services/aiRecommendationService");

const parseArgs = () => {
    const args = { limit: 50, force: false };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]) || 50;
        if (arg === "--force") args.force = true;
    }
    return args;
};

const disconnect = async () => {
    try {
        await mongoose.disconnect();
    } catch (_) {
        // optional
    }
};

const run = async () => {
    const args = parseArgs();
    await connectDatabase();

    console.log("[nightly-catalog-ai] starting smart listing enrichment...");
    const listing = await backfillAutoSmartListing({
        limit: args.limit,
        force: args.force,
    });
    console.log("[nightly-catalog-ai] smart listing:", listing);

    console.log("[nightly-catalog-ai] starting embedding backfill...");
    const embeddings = await backfillProductEmbeddings({
        limit: args.limit,
        force: args.force,
    });
    console.log("[nightly-catalog-ai] embeddings:", embeddings);

    console.log("[nightly-catalog-ai] pre-computing related products...");
    const related = await backfillRelatedProducts({ limit: args.limit });
    console.log("[nightly-catalog-ai] related products:", related);

    await disconnect();
    process.exit(0);
};

run().catch(async (error) => {
    console.error(error);
    await disconnect();
    process.exit(1);
});
