const productIndex = require("./indexes/productIndex");
const {
    refreshElasticsearchAvailability,
    isElasticConfigured,
    startElasticsearchHealthMonitor,
} = require("./availability");

module.exports = async function () {
    if (!isElasticConfigured()) {
        console.log("Elastic search disabled: no ELASTIC_SEARCH_BASE_URL configured.");
        return;
    }

    const elasticBaseUrl = String(global.env?.ELASTIC_SEARCH?.BASE_URL || "").trim();
    const reachable = await refreshElasticsearchAvailability();
    if (!reachable) {
        console.warn(
            `Elasticsearch configured at ${elasticBaseUrl} but not reachable. `
            + "Search will use MongoDB/AI fallback until ES is running (npm run es:up)."
        );
        startElasticsearchHealthMonitor();
        return;
    }

    console.log(`Elasticsearch connected (${elasticBaseUrl}). Initializing product index...`);
    await productIndex.init();
    startElasticsearchHealthMonitor();
    // await productIndex.sync();
};
