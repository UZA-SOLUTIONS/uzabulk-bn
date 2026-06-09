/* eslint-disable no-console */
require("../utils/globals");

const baseUrl = String(global.env?.ELASTIC_SEARCH?.BASE_URL || "").trim().replace(/\/+$/, "");
const timeoutMs = 4000;

const pingUrl = async (url) => {
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

const run = async () => {
    if (!baseUrl) {
        console.error("ELASTIC_SEARCH_BASE_URL is not set in .env");
        process.exitCode = 1;
        return;
    }

    const ok = await pingUrl(baseUrl);
    if (!ok) {
        console.error(`Elasticsearch unreachable at ${baseUrl}`);
        console.error("\nInstall Docker Desktop, then run:");
        console.error("  npm run es:up");
        console.error("  npm run es:reindex:products");
        process.exitCode = 1;
        return;
    }

    console.log(`Elasticsearch OK at ${baseUrl}`);
    try {
        const healthRes = await fetch(`${baseUrl}/_cluster/health`, {
            signal: AbortSignal.timeout(timeoutMs),
        });
        const health = await healthRes.json();
        console.log(`Cluster status: ${health?.status || "unknown"}`);
    } catch (_) {
        console.log("Cluster health check skipped.");
    }
};

run().finally(() => setTimeout(() => process.exit(), 50));
