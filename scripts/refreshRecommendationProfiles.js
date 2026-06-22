/* eslint-disable no-console */
/**
 * Refresh personalized recommendation profiles and surface caches (run every 15 min).
 *
 *   node scripts/refreshRecommendationProfiles.js
 *   node scripts/refreshRecommendationProfiles.js --limit=100
 */
require("../utils/globals");
const { connectDatabase } = require("../config/db");
const { refreshStaleProfiles } = require("../modules/recommendations/services/recommendationEngineService");

const parseArgs = () => {
    const args = { limit: 50 };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=")[1]) || 50;
    }
    return args;
};

const run = async () => {
    const args = parseArgs();
    await connectDatabase();
    const result = await refreshStaleProfiles({ limit: args.limit });
    console.log(result);
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
