/* eslint-disable no-console */
/**
 * Backfill DashScope embeddings for catalog products.
 *   node scripts/backfillProductEmbeddings.js
 *   node scripts/backfillProductEmbeddings.js --limit=100 --force
 */
require("../utils/globals");
const { connectDatabase } = require("../config/db");
const { backfillProductEmbeddings } = require("../modules/products/services/similarProductsService");

const parseArgs = () => {
    const args = { limit: 50, force: false };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]) || 50;
        if (arg === "--force") args.force = true;
    }
    return args;
};

const run = async () => {
    const args = parseArgs();
    await connectDatabase();
    const result = await backfillProductEmbeddings(args);
    console.log(result);
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
