const axios = require('axios');
const crypto = require('crypto');
const { extractMinOrderQty } = require('../helper/moq');
const { extractSupplierIds } = require('../helper/supplier');

const ALIBABA_BASE_APP_URL = env?.alibaba?.BASE_APP_URL || "http://gw.open.1688.com/openapi/";
const ALIBABA_APP_KEY = env?.alibaba?.APP_KEY || "";
const ALIBABA_APP_SECRET = env?.alibaba?.APP_SECRET || "";
const ALIBABA_AUTH_TOKEN = env?.alibaba?.AUTH_TOKEN || "";

const isGatewayAclDecline = (body) => {
    const code = String(body?.error_code || body?.code || body?.result?.code || "");
    const msg = String(body?.error_message || body?.message || body?.result?.message || "");
    return code.includes("APIACL") || /AppKey is not allowed/i.test(msg);
};

const generateHmacSha1Signature = (data, secretKey) => {
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(data);
    return hmac.digest('hex').toUpperCase();
}

const generateApiSignature = (urlPath, params, secretKey) => {
    const paramString = Object.entries(params).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, value]) => `${key}${value}`).join('');
    const concatString = `${urlPath}${paramString}`;
    const signature = generateHmacSha1Signature(concatString, secretKey);
    const urlParams = new URLSearchParams(params);
    urlParams.append('_aop_signature', signature);
    return `${urlPath}?${urlParams.toString()}`;
}

const is1688Success = (result) =>
    result?.success === true || result?.success === "true" || result?.success === 1;

/**
 * Parse body for com.alibaba.product / alibaba.product.get (shape varies by gateway version).
 * @param {*} response — axios response
 * @returns {object | null}
 */
const extractAlibabaProductGet = (response) => {
    const data = response?.data;
    if (!data) return null;
    if (data.productInfo) return data.productInfo;
    const top = data.result;
    if (!top) return null;
    if (top.productInfo) return top.productInfo;
    if (is1688Success(top) && top.result?.productInfo) return top.result.productInfo;
    if (typeof top.result === "object" && top.result?.productInfo) return top.result.productInfo;
    return null;
};

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
};

const normalizeSkuInfos = (skuInfos = []) => asArray(skuInfos).map((skuInfo) => {
    const rawAttributes = skuInfo?.skuAttributes || skuInfo?.attributes || skuInfo?.skuAttributesList || [];
    const skuAttributes = asArray(rawAttributes).map((attr) => ({
        attributeId: attr?.attributeId || attr?.attributeID || attr?.fid || attr?.name || attr?.attributeName,
        attributeNameTrans: attr?.attributeNameTrans || attr?.attributeName || attr?.name || "",
        valueTrans: attr?.valueTrans || attr?.value || attr?.valueName || "",
        skuImageUrl: attr?.skuImageUrl || attr?.imageUrl || attr?.image || "",
    }));

    return {
        specId: skuInfo?.specId || skuInfo?.specID || skuInfo?.skuId || skuInfo?.skuID,
        skuId: skuInfo?.skuId || skuInfo?.skuID || skuInfo?.specId || skuInfo?.specID,
        description: skuInfo?.description || "",
        image: skuInfo?.image || skuInfo?.skuImageUrl || "",
        sku: skuInfo?.sku || skuInfo?.skuCode || "",
        consignPrice: skuInfo?.consignPrice || skuInfo?.price || skuInfo?.salePrice,
        amountOnSale: skuInfo?.amountOnSale || skuInfo?.stock || skuInfo?.quantity || 0,
        skuAttributes,
    };
});

const normalizeAlibabaProductInfo = (productInfo, productId) => {
    if (!productInfo || typeof productInfo !== "object") return null;

    const rawImagePayload = productInfo.productImage || productInfo.image || {};
    const imagePayload = rawImagePayload && typeof rawImagePayload === "object" ? rawImagePayload : {};
    const images = asArray(
        imagePayload.images ||
        imagePayload.imageList ||
        productInfo.images ||
        productInfo.imageList ||
        productInfo.productImageList
    ).filter(Boolean);
    const mainImage = productInfo.mainImage || productInfo.pictureAuthUrl || productInfo.imageUrl;
    if (!images.length && mainImage) {
        images.push(mainImage);
    }

    const rawProductSaleInfo = productInfo.productSaleInfo || productInfo.saleInfo || {};
    const productSaleInfo = rawProductSaleInfo && typeof rawProductSaleInfo === "object" ? rawProductSaleInfo : {};
    const min_order_qty = extractMinOrderQty({
        ...productInfo,
        productSaleInfo,
    });
    const minOrderQuantity = productSaleInfo.minOrderQuantity || min_order_qty;
    const supplierIds = extractSupplierIds(productInfo);

    return {
        ...productInfo,
        ...(min_order_qty != null ? { min_order_qty } : {}),
        ...(minOrderQuantity != null ? { minOrderQuantity } : {}),
        ...(supplierIds.sellerOpenId ? { sellerOpenId: supplierIds.sellerOpenId } : {}),
        ...(supplierIds.seller_id ? { seller_id: supplierIds.seller_id } : {}),
        ...(supplierIds.supplier_id ? { supplier_id: supplierIds.supplier_id } : {}),
        status: productInfo.status || "published",
        topCategoryId: productInfo.topCategoryId || productInfo.categoryID || productInfo.categoryId || "",
        secondCategoryId: productInfo.secondCategoryId || "",
        thirdCategoryId: productInfo.thirdCategoryId || "",
        productSkuInfos: normalizeSkuInfos(productInfo.productSkuInfos || productInfo.skuInfos || productInfo.skuInfoList),
        subjectTrans: productInfo.subjectTrans || productInfo.subject || productInfo.title || productInfo.name || "",
        offerId: productInfo.offerId || productInfo.productID || productInfo.productId || productId,
        description: productInfo.description || productInfo.detail || productInfo.productDescription || "",
        productSaleInfo: {
            ...productSaleInfo,
            ...(minOrderQuantity != null ? { minOrderQuantity } : {}),
            priceRangeList: productSaleInfo.priceRangeList || productInfo.priceRangeList || [],
            amountOnSale: productSaleInfo.amountOnSale || productInfo.amountOnSale || productInfo.stock || 0,
            unitInfo: productSaleInfo.unitInfo || productInfo.unitInfo || {},
        },
        productImage: {
            ...imagePayload,
            images,
        },
        tradeScore: productInfo.tradeScore ||
            productInfo.score ||
            productInfo.rating ||
            productInfo.averageRating ||
            productInfo.productRating ||
            productInfo?.reviewInfo?.averageRating ||
            0,
        ratingCount: productInfo.ratingCount ||
            productInfo.reviewCount ||
            productInfo.evaluationCount ||
            productInfo.productReviewCount ||
            productInfo?.reviewInfo?.ratingCount ||
            productInfo?.reviewInfo?.reviewCount ||
            0,
        soldOut: productInfo.soldOut || productInfo.soldQuantity || 0,
        productAttribute: productInfo.productAttribute || productInfo.attributes || [],
        mainVideo: productInfo.mainVideo || "",
        detailVideo: productInfo.detailVideo || "",
        sellerOpenId: supplierIds.sellerOpenId,
        seller_id: supplierIds.seller_id,
        supplier_id: supplierIds.supplier_id,
        productShippingInfo: productInfo.productShippingInfo || productInfo.shippingInfo || {},
    };
};

/**
 * POST to signed URL (same param signing as GET). Many 1688 param2 APIs accept POST with query string.
 */
const makePostApiCall = async (urlPath, params, secretKey, extractFn) => {
    try {
        const signedPathAndQuery = generateApiSignature(urlPath, params, secretKey);
        const url = new URL(signedPathAndQuery, ALIBABA_BASE_APP_URL).toString();
        const response = await axios.post(url, null, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 60000,
        });
        const body = response?.data;
        if (isGatewayAclDecline(body)) return null;

        const extracted = extractFn ? extractFn(response) : null;
        if (extracted) return extracted;
        const top = body?.result;
        if (is1688Success(top)) {
            return top.result !== undefined ? top.result : top;
        }
        if (top && !is1688Success(top)) {
            if (isGatewayAclDecline(top)) return null;
            console.warn("1688 POST API unsuccessful:", top.code, top.message, top.errMsg);
        }
        return null;
    } catch (error) {
        if (isGatewayAclDecline(error?.response?.data)) return null;
        console.error("Alibaba POST API error", error?.response?.data || error.message);
    }
    return null;
};

const makeApiCall = async (urlPath, params, secretKey) => {
    try {
        const signedUrl = generateApiSignature(urlPath, params, secretKey);
        const url = new URL(signedUrl, ALIBABA_BASE_APP_URL);
        const headers = { "Content-Type": "application/json" };
        const response = await axios.get(url.toString(), { headers, timeout: 60000 });
        const body = response?.data;
        if (isGatewayAclDecline(body)) return null;

        const top = body?.result;
        if (is1688Success(top)) {
            return top.result !== undefined ? top.result : top;
        }
        if (top && !is1688Success(top)) {
            if (isGatewayAclDecline(top)) return null;
            console.warn("1688 API returned unsuccessful:", top.code, top.message);
        }
        return null;
    } catch (error) {
        if (isGatewayAclDecline(error?.response?.data)) return null;
        console.error("API Call Error: Unsuccessful response", error?.response?.data || error);
    }
};

// Import Product Detail
const getProductDetail = async (productId) => {
    if (!ALIBABA_APP_KEY || !ALIBABA_APP_SECRET || !ALIBABA_AUTH_TOKEN) {
        console.error("Alibaba credentials are missing. Check ALIBABA_APP_KEY / ALIBABA_APP_SECRET / ALIBABA_AUTH_TOKEN");
        return null;
    }

    const urlPath = `param2/1/com.alibaba.fenxiao.crossborder/product.search.queryProductDetail/${ALIBABA_APP_KEY}`;
    const params = { "offerDetailParam": JSON.stringify({ "offerId": productId, "country": "en" }), "access_token": ALIBABA_AUTH_TOKEN };
    const secretKey = ALIBABA_APP_SECRET;

    const crossborderDetail = await makeApiCall(urlPath, params, secretKey);
    if (crossborderDetail) {
        const min_order_qty = extractMinOrderQty(crossborderDetail);
        const minOrderQuantity = crossborderDetail.minOrderQuantity
            || crossborderDetail.productSaleInfo?.minOrderQuantity
            || min_order_qty;
        const supplierIds = extractSupplierIds(crossborderDetail);
        return {
            ...crossborderDetail,
            ...(min_order_qty != null ? { min_order_qty } : {}),
            ...(minOrderQuantity != null ? { minOrderQuantity } : {}),
            ...(supplierIds.sellerOpenId ? { sellerOpenId: supplierIds.sellerOpenId } : {}),
            ...(supplierIds.seller_id ? { seller_id: supplierIds.seller_id } : {}),
            ...(supplierIds.supplier_id ? { supplier_id: supplierIds.supplier_id } : {}),
        };
    }

    const productInfo = await getAlibabaProduct(productId, { scene: "1688" });
    return normalizeAlibabaProductInfo(productInfo, productId);
};

/**
 * Multilingual image search — com.alibaba.fenxiao.crossborder / product.search.imageQuery
 * @see https://gw.open.1688.com/openapi/param2/1/com.alibaba.fenxiao.crossborder/product.search.imageQuery/
 * @param {{ imageAddress: string, beginPage?: number, pageSize?: number, country?: string }} opts
 * @returns {Promise<{ totalRecords?: number, totalPage?: number, currentPage?: number, pageSize?: number, data?: Array } | null>}
 */
const searchImageQuery = async ({
    imageAddress,
    beginPage = 1,
    pageSize = 32,
    country = "en",
}) => {
    if (!ALIBABA_APP_KEY || !ALIBABA_APP_SECRET || !ALIBABA_AUTH_TOKEN) {
        console.error("Alibaba credentials are missing for image search.");
        return null;
    }
    if (!imageAddress || typeof imageAddress !== "string") {
        return null;
    }

    const urlPath = `param2/1/com.alibaba.fenxiao.crossborder/product.search.imageQuery/${ALIBABA_APP_KEY}`;
    const offerQueryParam = JSON.stringify({
        beginPage: Number(beginPage) || 1,
        pageSize: Number(pageSize) || 32,
        country: String(country || "en").trim() || "en",
        imageAddress: imageAddress.trim(),
    });
    const params = {
        access_token: ALIBABA_AUTH_TOKEN,
        _aop_timestamp: Date.now().toString(),
        offerQueryParam,
    };

    return await makeApiCall(urlPath, params, ALIBABA_APP_SECRET);
};

/**
 * Search 1688 crossborder products by keyword and pagination.
 * Returns raw payload shape from gateway (expects .data array with offerId).
 */
const searchProductsQuery = async ({
    keyword = "",
    beginPage = 1,
    pageSize = 20,
    country = "en",
}) => {
    if (!ALIBABA_APP_KEY || !ALIBABA_APP_SECRET || !ALIBABA_AUTH_TOKEN) {
        console.error("Alibaba credentials are missing for product.search.query.");
        return null;
    }

    const urlPath = `param2/1/com.alibaba.fenxiao.crossborder/product.search.query/${ALIBABA_APP_KEY}`;
    const offerQueryParam = JSON.stringify({
        beginPage: Number(beginPage) || 1,
        pageSize: Number(pageSize) || 20,
        country: String(country || "en").trim() || "en",
        keyWord: String(keyword || "").trim(),
    });

    const params = {
        access_token: ALIBABA_AUTH_TOKEN,
        _aop_timestamp: Date.now().toString(),
        offerQueryParam,
    };

    return await makeApiCall(urlPath, params, ALIBABA_APP_SECRET);
};

/**
 * Open Platform — alibaba.product.get (product by 1688 product ID).
 * POST https://gw.open.1688.com/openapi/param2/1/com.alibaba.product/alibaba.product.get/${APPKEY}
 *
 * @param {string|number} productID — 1688 product / offer id (Long)
 * @param {{ webSite?: string, scene?: string }} [opts] — optional site / scene (e.g. scene "1688")
 * @returns {Promise<object | null>} productInfo (alibaba.product.ProductInfo) or null
 */
const getAlibabaProduct = async (productID, opts = {}) => {
    if (!ALIBABA_APP_KEY || !ALIBABA_APP_SECRET || !ALIBABA_AUTH_TOKEN) {
        console.error("Alibaba credentials are missing for alibaba.product.get.");
        return null;
    }
    const id = productID != null ? Number(productID) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const urlPath = `param2/1/com.alibaba.product/alibaba.product.get/${ALIBABA_APP_KEY}`;
    const params = {
        access_token: ALIBABA_AUTH_TOKEN,
        _aop_timestamp: Date.now().toString(),
        productID: String(id),
    };
    if (opts.webSite != null && opts.webSite !== "") {
        params.webSite = String(opts.webSite);
    }
    if (opts.scene != null && opts.scene !== "") {
        params.scene = String(opts.scene);
    }

    return await makePostApiCall(urlPath, params, ALIBABA_APP_SECRET, extractAlibabaProductGet);
};

module.exports = { getProductDetail, searchImageQuery, getAlibabaProduct, searchProductsQuery };