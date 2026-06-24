const Order = require("../models/ordersTable");
const { sync1688OrderState } = require("../modules/orders/services/alibabaOrderRelay");
const { isMongoConnected } = require("../config/db");
const { isImageSearchBusy } = require("../utils/imageSearchGate");

const DAY_MS = 24 * 60 * 60 * 1000;
const ENABLED = String(process.env.ALIBABA_LOGISTICS_JOB_ENABLED || "true").toLowerCase() !== "false";
const INTERVAL_HOURS = Number(process.env.ALIBABA_LOGISTICS_POLL_HOURS || 6);
const BATCH_LIMIT = Number(process.env.ALIBABA_LOGISTICS_BATCH_LIMIT || 50);

const ACTIVE_STATUSES = [
    "WAIT_SELLER_SEND",
    "WAIT_BUYER_RECEIVE",
    "WAIT_CONFIRM",
    "CONFIRM",
    "inroute",
    "confirmed",
];

let intervalHandle = null;
let running = false;

const runLogisticsPollingJob = async () => {
    if (running) {
        console.log("[1688-logistics-job] Skipped — previous run still active");
        return;
    }

    if (!isMongoConnected()) {
        console.log("[1688-logistics-job] Skipped — MongoDB not connected");
        return;
    }

    if (isImageSearchBusy()) {
        console.log("[1688-logistics-job] Skipped — image search in progress");
        return;
    }

    running = true;
    const started = Date.now();

    try {
        const orders = await Order.find({
            "alibaba1688.primary_order_id": { $exists: true, $ne: "" },
            $or: [
                { "alibaba1688.status": { $in: ACTIVE_STATUSES } },
                { orderStatus: { $in: ["confirmed", "inroute", "pending"] } },
            ],
        })
            .limit(BATCH_LIMIT)
            .lean();

        let synced = 0;
        for (const order of orders) {
            try {
                const result = await sync1688OrderState(order);
                if (result.ok && result.updates) {
                    await Order.updateOne({ _id: order._id }, { $set: result.updates });
                    synced += 1;
                }
            } catch (err) {
                console.warn(`[1688-logistics-job] Order ${order._id}: ${err.message}`);
            }
        }

        console.log(
            `[1688-logistics-job] Done in ${Date.now() - started}ms — synced=${synced}/${orders.length}`
        );
    } catch (error) {
        console.error("[1688-logistics-job] Failed:", error.message);
    } finally {
        running = false;
    }
};

const startLogisticsPollingJob = () => {
    if (!ENABLED) {
        console.log("[1688-logistics-job] Disabled (ALIBABA_LOGISTICS_JOB_ENABLED=false)");
        return;
    }

    const intervalMs = Math.max(1, INTERVAL_HOURS) * (DAY_MS / 24);

    setTimeout(() => {
        runLogisticsPollingJob().catch((e) => console.error("[1688-logistics-job] Initial run:", e.message));
    }, 120_000);

    intervalHandle = setInterval(() => {
        runLogisticsPollingJob().catch((e) => console.error("[1688-logistics-job] Scheduled run:", e.message));
    }, intervalMs);

    console.log(`[1688-logistics-job] Scheduled every ${INTERVAL_HOURS}h, batch=${BATCH_LIMIT}`);
};

const stopLogisticsPollingJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = {
    startLogisticsPollingJob,
    stopLogisticsPollingJob,
    runLogisticsPollingJob,
};
