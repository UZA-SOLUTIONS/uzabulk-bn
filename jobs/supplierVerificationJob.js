const {
    refreshStaleSuppliers,
    verifySuppliersFromCatalog,
} = require("../modules/products/services/supplierVerificationService");
const { isMongoConnected } = require("../config/db");
const { isImageSearchBusy } = require("../utils/imageSearchGate");

const DAY_MS = 24 * 60 * 60 * 1000;
const ENABLED = String(process.env.SUPPLIER_VERIFICATION_JOB_ENABLED || "true").toLowerCase() !== "false";
const INTERVAL_DAYS = Number(process.env.SUPPLIER_VERIFICATION_JOB_INTERVAL_DAYS || 1);
const BATCH_LIMIT = Number(process.env.SUPPLIER_VERIFICATION_BATCH_LIMIT || 40);

let intervalHandle = null;
let running = false;

const runSupplierVerificationJob = async () => {
    if (running) {
        console.log("[supplier-verification-job] Skipped — previous run still active");
        return;
    }

    if (!isMongoConnected()) {
        console.log("[supplier-verification-job] Skipped — MongoDB not connected");
        return;
    }

    if (isImageSearchBusy()) {
        console.log("[supplier-verification-job] Skipped — image search in progress");
        return;
    }

    running = true;
    const started = Date.now();

    try {
        const refresh = await refreshStaleSuppliers({ limit: BATCH_LIMIT });
        const catalog = await verifySuppliersFromCatalog({ limit: Math.ceil(BATCH_LIMIT / 2) });

        console.log(
            `[supplier-verification-job] Done in ${Date.now() - started}ms — ` +
            `refreshed=${refresh.refreshed}/${refresh.scanned}, ` +
            `catalog_verified=${catalog.verified}/${catalog.scanned}`
        );
    } catch (error) {
        console.error("[supplier-verification-job] Failed:", error.message);
    } finally {
        running = false;
    }
};

const startSupplierVerificationJob = () => {
    if (!ENABLED) {
        console.log("[supplier-verification-job] Disabled (SUPPLIER_VERIFICATION_JOB_ENABLED=false)");
        return;
    }

    const intervalMs = Math.max(1, INTERVAL_DAYS) * DAY_MS;

    setTimeout(() => {
        runSupplierVerificationJob().catch((error) => {
            console.error("[supplier-verification-job] Initial run error:", error.message);
        });
    }, 60_000);

    intervalHandle = setInterval(() => {
        runSupplierVerificationJob().catch((error) => {
            console.error("[supplier-verification-job] Scheduled run error:", error.message);
        });
    }, intervalMs);

    console.log(
        `[supplier-verification-job] Scheduled every ${INTERVAL_DAYS} day(s), batch=${BATCH_LIMIT}`
    );
};

const stopSupplierVerificationJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = {
    startSupplierVerificationJob,
    stopSupplierVerificationJob,
    runSupplierVerificationJob,
};
