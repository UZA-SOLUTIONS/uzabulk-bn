const Product = require("../models/productsTable");
const { getProductDetail } = require("../modules/products/services/alibaba");
const { updateProductDetails } = require("../modules/products/helper/migration");

const DAY_MS = 24 * 60 * 60 * 1000;
const ENABLED = String(process.env.ALIBABA_CATALOG_SYNC_JOB_ENABLED || "true").toLowerCase() !== "false";
const INTERVAL_HOURS = Number(process.env.ALIBABA_CATALOG_SYNC_INTERVAL_HOURS || 24);
const BATCH_LIMIT = Number(process.env.ALIBABA_CATALOG_SYNC_BATCH_LIMIT || 30);
const STALE_HOURS = Number(process.env.ALIBABA_CATALOG_STALE_HOURS || 24);

let intervalHandle = null;
let running = false;

const runCatalogSyncJob = async () => {
    if (running) {
        console.log("[1688-catalog-sync] Skipped — previous run still active");
        return;
    }

    running = true;
    const started = Date.now();
    const staleBefore = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

    try {
        const products = await Product.find({
            offerId: { $exists: true, $ne: null, $ne: "" },
            status: { $ne: "archived" },
            $or: [
                { last_updated: { $lt: staleBefore } },
                { last_updated: { $exists: false } },
            ],
        })
            .select("_id offerId name last_updated")
            .limit(BATCH_LIMIT)
            .lean();

        let synced = 0;
        for (const product of products) {
            try {
                const details = await getProductDetail(product.offerId);
                if (details) {
                    await updateProductDetails(product, details);
                    synced += 1;
                }
            } catch (err) {
                console.warn(`[1688-catalog-sync] Product ${product._id}: ${err.message}`);
            }
        }

        console.log(
            `[1688-catalog-sync] Done in ${Date.now() - started}ms — synced=${synced}/${products.length}`
        );
    } catch (error) {
        console.error("[1688-catalog-sync] Failed:", error.message);
    } finally {
        running = false;
    }
};

const startCatalogSyncJob = () => {
    if (!ENABLED) {
        console.log("[1688-catalog-sync] Disabled (ALIBABA_CATALOG_SYNC_JOB_ENABLED=false)");
        return;
    }

    const intervalMs = Math.max(1, INTERVAL_HOURS) * (DAY_MS / 24);

    setTimeout(() => {
        runCatalogSyncJob().catch((e) => console.error("[1688-catalog-sync] Initial run:", e.message));
    }, 180_000);

    intervalHandle = setInterval(() => {
        runCatalogSyncJob().catch((e) => console.error("[1688-catalog-sync] Scheduled run:", e.message));
    }, intervalMs);

    console.log(
        `[1688-catalog-sync] Scheduled every ${INTERVAL_HOURS}h, batch=${BATCH_LIMIT}, stale>${STALE_HOURS}h`
    );
};

const stopCatalogSyncJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = {
    startCatalogSyncJob,
    stopCatalogSyncJob,
    runCatalogSyncJob,
};
