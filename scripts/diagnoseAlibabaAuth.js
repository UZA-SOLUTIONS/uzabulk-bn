/* eslint-disable no-console */
require("../utils/globals");

const axios = require("axios");
const crypto = require("crypto");

const base = env.alibaba.BASE_APP_URL || "http://gw.open.1688.com/openapi/";
const appKey = env.alibaba.APP_KEY;
const secret = env.alibaba.APP_SECRET;
const token = env.alibaba.AUTH_TOKEN;

const signUrl = (urlPath, params) => {
    const paramString = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}${v}`)
        .join("");
    const hmac = crypto.createHmac("sha1", secret);
    hmac.update(`${urlPath}${paramString}`);
    const signature = hmac.digest("hex").toUpperCase();
    const qs = new URLSearchParams(params);
    qs.append("_aop_signature", signature);
    return new URL(`${urlPath}?${qs.toString()}`, base).toString();
};

const runCall = async (label, method, urlPath, params) => {
    try {
        const url = signUrl(urlPath, params);
        const response = method === "POST"
            ? await axios.post(url, null, {
                timeout: 60000,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            })
            : await axios.get(url, { timeout: 60000 });
        console.log(`${label}: OK`);
        console.log(JSON.stringify(response.data).slice(0, 400));
    } catch (error) {
        console.log(`${label}: ERROR`);
        console.log(JSON.stringify(error?.response?.data || error.message));
    }
};

const run = async () => {
    const offerId = String(process.argv[2] || "711309685754");
    const detailUrlPath = `param2/1/com.alibaba.fenxiao.crossborder/product.search.queryProductDetail/${appKey}`;
    const productGetUrlPath = `param2/1/com.alibaba.product/alibaba.product.get/${appKey}`;

    console.log(`Testing appKey=${appKey}, token=***${String(token || "").slice(-8)}, offerId=${offerId}`);

    await runCall("GET detail with country=en", "GET", detailUrlPath, {
        access_token: token,
        offerDetailParam: JSON.stringify({ offerId, country: "en" }),
    });
    await runCall("GET detail without country", "GET", detailUrlPath, {
        access_token: token,
        offerDetailParam: JSON.stringify({ offerId }),
    });
    await runCall("POST detail with country=en", "POST", detailUrlPath, {
        access_token: token,
        offerDetailParam: JSON.stringify({ offerId, country: "en" }),
    });
    await runCall("POST detail without country", "POST", detailUrlPath, {
        access_token: token,
        offerDetailParam: JSON.stringify({ offerId }),
    });

    await runCall("POST product.get with scene=1688", "POST", productGetUrlPath, {
        access_token: token,
        productID: offerId,
        scene: "1688",
    });
    await runCall("POST product.get with webSite=1688", "POST", productGetUrlPath, {
        access_token: token,
        productID: offerId,
        webSite: "1688",
    });
};

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
