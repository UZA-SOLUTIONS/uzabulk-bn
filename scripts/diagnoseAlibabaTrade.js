/* eslint-disable no-console */
/**
 * Smoke-test 1688 trade + logistics API access.
 * Usage: node scripts/diagnoseAlibabaTrade.js [offerId] [specId] [quantity]
 */
require("../utils/globals");

const { createCrossOrder, getBuyerOrderView, getPaymentUrl } = require("../modules/orders/services/alibabaTrade");
const { getLogisticsInfos } = require("../modules/orders/services/alibabaLogistics");
const client = require("../lib/alibaba1688Client");
const { getIntegrationStatus } = require("../modules/alibaba/services/integrationStatus");

const run = async () => {
    const offerId = process.argv[2] || process.env.ALIBABA_TEST_OFFER_ID;
    const specId = process.argv[3] || process.env.ALIBABA_TEST_SPEC_ID;
    const quantity = Number(process.argv[4] || 1);
    const dryRun = String(process.env.ALIBABA_TRADE_DRY_RUN || "true").toLowerCase() !== "false";

    console.log("1688 Trade API diagnostic");
    console.log(JSON.stringify(await getIntegrationStatus(), null, 2));

    if (!client.isConfigured()) {
        console.error("Missing ALIBABA_APP_KEY / ALIBABA_APP_SECRET / ALIBABA_AUTH_TOKEN");
        process.exit(1);
    }

    if (!offerId || !specId) {
        console.log("Skipping createCrossOrder — pass offerId and specId:");
        console.log("  npm run alibaba:diagnose:trade -- <offerId> <specId> [qty]");
        console.log("Set ALIBABA_TRADE_DRY_RUN=false to actually create a test order.");
        process.exit(0);
    }

    if (dryRun) {
        console.log(`DRY RUN — would create order offerId=${offerId} specId=${specId} qty=${quantity}`);
        console.log("Set ALIBABA_TRADE_DRY_RUN=false to execute.");
        process.exit(0);
    }

    const thirdOrderId = `UZA-TEST-${Date.now()}`;
    const result = await createCrossOrder({
        thirdOrderId,
        cargoParamList: [{ offerId: Number(offerId), specId: String(specId), quantity }],
        message: "UZA Bulk trade API diagnostic",
    });

    console.log("createCrossOrder:", JSON.stringify(result, null, 2).slice(0, 1200));

    const orderId = result?.data?.orderId
        || result?.data?.orderList?.[0]?.orderId
        || null;

    if (orderId) {
        const [view, pay, logistics] = await Promise.all([
            getBuyerOrderView(orderId),
            getPaymentUrl(orderId),
            getLogisticsInfos(orderId),
        ]);
        console.log("getBuyerOrderView:", JSON.stringify(view).slice(0, 600));
        console.log("getPaymentUrl:", JSON.stringify(pay).slice(0, 400));
        console.log("getLogisticsInfos:", JSON.stringify(logistics).slice(0, 400));
    }
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
