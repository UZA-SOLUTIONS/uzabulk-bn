const { isMongoConnected } = require("../config/db");
const {
    isElasticConfigured,
    getElasticsearchAvailability,
} = require("../elasticsearch/availability");
const { runIncrementalSync } = require("../elasticsearch/productReindexShared");
const { isImageSearchBusy } = require("../utils/imageSearchGate");

const DAY_MS = 24 * 60 * 60 * 1000;
const ENABLED = String(process.env.ES_PRODUCT_SYNC_JOB_ENABLED || "true").toLowerCase() !== "false";
/** 0 = no timer; sync runs after 1688 catalog job (and via npm run es:product:sync). */
const INTERVAL_HOURS = Number(process.env.ES_PRODUCT_SYNC_INTERVAL_HOURS || 0);

let intervalHandle = null;
let running = false;
let pendingRun = false;

const prefixLog = (reason) => (message) => {
    const tag = reason ? ` (${reason})` : "";
    console.log(`[es-product-sync]${tag} ${message}`);
};

const runEsProductSyncJob = async ({ reason = "scheduled" } = {}) => {
    if (running) {
        pendingRun = true;
        console.log("[es-product-sync] Queued — previous run still active");
        return { skipped: true, reason: "busy" };
    }

    if (!isMongoConnected()) {
        console.log("[es-product-sync] Skipped — MongoDB not connected");
        return { skipped: true, reason: "mongo" };
    }

    if (isImageSearchBusy()) {
        console.log("[es-product-sync] Skipped — image search in progress");
        return { skipped: true, reason: "image-search" };
    }

    if (!isElasticConfigured()) {
        return { skipped: true, reason: "es-disabled" };
    }

    const esAvailable = await getElasticsearchAvailability();
    if (!esAvailable) {
        console.log("[es-product-sync] Skipped — Elasticsearch not reachable");
        return { skipped: true, reason: "es-unreachable" };
    }

    running = true;
    const started = Date.now();
    const log = prefixLog(reason);

    try {
        const result = await runIncrementalSync({ log });
        console.log(
            `[es-product-sync] Done in ${Date.now() - started}ms — indexed=${result.indexed}, mongo=${result.mongoTotal}, es=${result.esTotal}`
        );
        return { skipped: false, ...result };
    } catch (error) {
        const msg = error?.message || String(error);
        if (msg.includes("No alias index found")) {
            console.warn("[es-product-sync] Skipped — no products index yet (run es:reindex:products first)");
            return { skipped: true, reason: "no-index" };
        }
        console.error("[es-product-sync] Failed:", msg);
        throw error;
    } finally {
        running = false;
        if (pendingRun) {
            pendingRun = false;
            setImmediate(() => {
                runEsProductSyncJob({ reason: "queued" }).catch((err) => {
                    console.error("[es-product-sync] Queued run failed:", err.message);
                });
            });
        }
    }
};

const scheduleEsProductSyncAfterCatalog = () => {
    runEsProductSyncJob({ reason: "1688-catalog" }).catch((err) => {
        console.error("[es-product-sync] Post-catalog sync failed:", err.message);
    });
};

const startEsProductSyncJob = () => {
    if (!ENABLED) {
        console.log("[es-product-sync] Disabled (ES_PRODUCT_SYNC_JOB_ENABLED=false)");
        return;
    }

    if (INTERVAL_HOURS > 0) {
        const intervalMs = INTERVAL_HOURS * (DAY_MS / 24);
        intervalHandle = setInterval(() => {
            runEsProductSyncJob({ reason: "scheduled" }).catch((err) => {
                console.error("[es-product-sync] Scheduled run failed:", err.message);
            });
        }, intervalMs);
        console.log(`[es-product-sync] Also scheduled every ${INTERVAL_HOURS}h (ES_PRODUCT_SYNC_INTERVAL_HOURS)`);
    } else {
        console.log("[es-product-sync] Runs after 1688 catalog sync when products are updated");
    }
};

const stopEsProductSyncJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = {
    startEsProductSyncJob,
    stopEsProductSyncJob,
    runEsProductSyncJob,
    scheduleEsProductSyncAfterCatalog,
};
