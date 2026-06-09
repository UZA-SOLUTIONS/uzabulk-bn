const productIndex = require("./indexes/productIndex");

const pingElasticsearch = async (baseUrl, timeoutMs = 4000) => {
    const url = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!url) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        return res.ok;
    } catch (_) {
        return false;
    } finally {
        clearTimeout(timer);
    }
};

module.exports = async function () {
    const elasticBaseUrl = String(global.env?.ELASTIC_SEARCH?.BASE_URL || "").trim();
    if (!elasticBaseUrl) {
        console.log("Elastic search disabled: no ELASTIC_SEARCH_BASE_URL configured.");
        return;
    }

    const reachable = await pingElasticsearch(elasticBaseUrl);
    if (!reachable) {
        console.warn(
            `Elasticsearch configured at ${elasticBaseUrl} but not reachable. `
            + "Search will use MongoDB fallback until ES is running (npm run es:up)."
        );
        return;
    }

    console.log(`Elasticsearch connected (${elasticBaseUrl}). Initializing product index...`);
    await productIndex.init();
    // await productIndex.sync();
}
