/* eslint-disable no-console */
require("../utils/globals");

const client = require("../lib/alibaba1688Client");
const { getProductDetail, getAlibabaProduct } = require("../modules/products/services/alibaba");
const { getIntegrationStatus } = require("../modules/alibaba/services/integrationStatus");

const run = async () => {
    const offerId = String(process.argv[2] || "711309685754");

    console.log(`Testing appKey=${env.alibaba.APP_KEY}, offerId=${offerId}`);
    console.log("Integration status:", JSON.stringify(await getIntegrationStatus(), null, 2));

    if (!client.isConfigured()) {
        console.error("Alibaba credentials missing.");
        process.exit(1);
    }

    const detail = await getProductDetail(offerId);
    console.log("getProductDetail:", detail ? "OK" : "FAILED");
    if (detail) {
        console.log(JSON.stringify({
            offerId: detail.offerId,
            subjectTrans: detail.subjectTrans?.slice(0, 80),
            skuCount: detail.productSkuInfos?.length,
        }));
    }

    const productGet = await getAlibabaProduct(offerId, { scene: "1688" });
    console.log("getAlibabaProduct:", productGet ? "OK" : "FAILED");
};

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
