const getEnv = () => global.env || {};

let reachable = false;
let checked = false;
let lastWarnAt = 0;

const WARN_INTERVAL_MS = 60_000;

const isElasticConfigured = () =>
    Boolean(String(getEnv()?.ELASTIC_SEARCH?.BASE_URL || "").trim());

const pingElasticsearch = async (baseUrl, timeoutMs = 2500) => {
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

const isConnectionError = (error) => {
    const name = String(error?.name || "").toLowerCase();
    const message = String(error?.message || error || "").toLowerCase();
    return (
        name.includes("connection")
        || message.includes("econnrefused")
        || message.includes("etimedout")
        || message.includes("enotfound")
        || message.includes("socket hang up")
        || message.includes("connect")
        || error?.meta?.statusCode === 0
    );
};

const warnOnce = (message) => {
    const now = Date.now();
    if (now - lastWarnAt < WARN_INTERVAL_MS) return;
    lastWarnAt = now;
    console.warn(message);
};

const refreshElasticsearchAvailability = async () => {
    if (!isElasticConfigured()) {
        reachable = false;
        checked = true;
        return false;
    }

    const baseUrl = String(getEnv()?.ELASTIC_SEARCH?.BASE_URL || "").trim();
    reachable = await pingElasticsearch(baseUrl);
    checked = true;
    return reachable;
};

const isElasticsearchReachable = () => isElasticConfigured() && reachable;

const markElasticsearchUnreachable = (reason) => {
    if (reachable) {
        warnOnce(
            reason
            || "Elasticsearch became unreachable. Product search will use MongoDB until the API restarts."
        );
    }
    reachable = false;
    checked = true;
};

const logElasticsearchSearchError = (error) => {
    if (isConnectionError(error)) {
        markElasticsearchUnreachable(
            `Elasticsearch is not running (${error?.message || "connection failed"}). `
            + "Using MongoDB for search. Start ES with: npm run es:up"
        );
        return;
    }
    console.error("Elasticsearch search error:", error);
};

let healthMonitorTimer = null;

const startElasticsearchHealthMonitor = (intervalMs = 45_000) => {
    if (!isElasticConfigured() || healthMonitorTimer) return;

    healthMonitorTimer = setInterval(async () => {
        if (!isElasticConfigured()) return;
        if (reachable) return;
        const ok = await refreshElasticsearchAvailability();
        if (ok) {
            console.log("Elasticsearch is now reachable — text search will use ES.");
        }
    }, Math.max(15_000, Number(intervalMs) || 45_000));

    if (typeof healthMonitorTimer.unref === "function") {
        healthMonitorTimer.unref();
    }
};

/**
 * Fast availability check for request handlers — avoids re-pinging ES on every search.
 */
const getElasticsearchAvailability = async () => {
    if (!isElasticConfigured()) {
        reachable = false;
        checked = true;
        return false;
    }
    if (reachable) return true;
    if (checked) return false;
    return refreshElasticsearchAvailability();
};

module.exports = {
    isElasticConfigured,
    pingElasticsearch,
    isConnectionError,
    refreshElasticsearchAvailability,
    getElasticsearchAvailability,
    isElasticsearchReachable,
    markElasticsearchUnreachable,
    logElasticsearchSearchError,
    startElasticsearchHealthMonitor,
};
