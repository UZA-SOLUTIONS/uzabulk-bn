/* eslint-disable no-console */
/**
 * Backfill AI smart listing on existing catalog products.
 *   npm run smart-listing:backfill
 *   npm run smart-listing:backfill -- --limit=10 --force
 */
require("../utils/globals");
const { connectDatabase } = require("../config/db");
const { backfillAutoSmartListing } = require("../modules/ai/services/autoSmartListingService");

const parseArg = (name) => {
    const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : null;
};

const run = async () => {
    const limit = Number(parseArg("limit") || 20);
    const force = process.argv.includes("--force");

    await connectDatabase();
    const result = await backfillAutoSmartListing({ limit, force });
    console.log(result);
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
