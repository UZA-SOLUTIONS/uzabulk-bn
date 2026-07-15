const client = require("../../../lib/alibaba1688Client");
const { extractMinOrderQty } = require("../helper/moq");
const { extractSupplierIds } = require("../helper/supplier");
const {
    pickRawPriceRangeList,
    normalizePriceRangeList,
} = require("../helper/pricing");

const CROSSBORDER_NS = "com.alibaba.fenxiao.crossborder";
const PRODUCT_NS = "com.alibaba.product";

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
            priceRangeList: normalizePriceRangeList(
                pickRawPriceRangeList(
                    productSaleInfo.priceRangeList,
                    productSaleInfo.priceRanges,
                    productInfo.priceRangeList,
                    productInfo.priceRanges,
                    productInfo.saleInfo?.priceRangeList,
                    productInfo.saleInfo?.priceRanges
                )
            ),
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

const extractAlibabaProductGet = (data) => {
    if (!data) return null;
    if (data.productInfo) return data.productInfo;
    if (data.result?.productInfo) return data.result.productInfo;
    return data;
};

const getProductDetail = async (productId) => {
    if (!client.isConfigured()) {
        console.error("Alibaba credentials are missing. Check ALIBABA_APP_KEY / ALIBABA_APP_SECRET / ALIBABA_AUTH_TOKEN");
        return null;
    }

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.search.queryProductDetail");
    const result = await client.get(urlPath, {
        offerDetailParam: JSON.stringify({ offerId: productId, country: "en" }),
    });

    const crossborderDetail = result.ok ? result.data : null;
    if (crossborderDetail) {
        return normalizeAlibabaProductInfo(crossborderDetail, productId);
    }

    const productInfo = await getAlibabaProduct(productId, { scene: "1688" });
    return normalizeAlibabaProductInfo(productInfo, productId);
};

const extractImageSearchOffers = (payload) => {
    if (!payload) return [];
    const candidates = [
        payload?.searchOfferModelList,
        payload?.data?.searchOfferModelList,
        payload?.result?.searchOfferModelList,
        payload?.offerList,
        payload?.data?.offerList,
        payload?.data,
        payload?.result?.data,
        payload?.sameOfferModelList,
        payload?.data?.sameOfferModelList,
        payload?.relatedOfferList,
        payload?.data?.relatedOfferList,
    ];
    for (const list of candidates) {
        if (Array.isArray(list) && list.length) return list;
    }
    return [];
};

const extractDomesticImageSearchOffers = (payload) => {
    if (!payload) return [];
    const list = payload?.imageSearchResult
        || payload?.data?.imageSearchResult
        || payload?.result?.imageSearchResult;
    if (!Array.isArray(list)) return [];
    return list.map((row) => ({
        offerId: row?.offerId || row?.offer_id,
        subject: row?.subject || row?.title || "",
        subjectTrans: row?.subject || row?.title || "",
        imageUrl: row?.image || row?.imageUrl || "",
        price: row?.price,
        detailUrl: row?.detailUrl,
    })).filter((row) => row.offerId);
};

const mapOfferToProductStub = (row = {}) => {
    const offerId = String(row?.offerId || row?.offer_id || row?.id || "").trim();
    if (!offerId) return null;

    const price = row?.priceInfo?.price
        ?? row?.priceInfo?.jxhyPrice
        ?? row?.price
        ?? 0;

    return {
        offerId,
        name: row?.subjectTrans || row?.subject || row?.title || "Product",
        price: Number(price) || 0,
        compare_price: 0,
        featured_image: row?.imageUrl || row?.image || row?.offerImage?.imageUrl || "",
        average_rating: Number(row?.tradeScore || row?.score || 0) || 0,
        rating_count: 0,
        sold_count: Number(row?.monthSold || row?.sales7d || 0) || 0,
        min_order_qty: Number(row?.minOrderQuantity || 0) || undefined,
        short_description: "",
        status: "active",
        external: true,
        match_type: "alibaba_image_search",
    };
};

const isValidAlibabaImageId = (value) => {
    const id = String(value || "").trim();
    return /^\d+$/.test(id) && id.length > 0 && id.length <= 32;
};

const uploadProductImage = async ({ imageBase64, outMemberId = "" } = {}) => {
    if (!client.isConfigured()) {
        console.error("Alibaba credentials are missing for product.image.upload.");
        return null;
    }

    const base64 = String(imageBase64 || "").trim();
    if (!base64) return null;

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.image.upload");
    const uploadImageParam = JSON.stringify({
        imageBase64: base64,
        ...(outMemberId ? { outMemberId: String(outMemberId) } : {}),
    });

    const result = await client.post(urlPath, { uploadImageParam });
    if (!result.ok) {
        console.warn("[1688] product.image.upload failed:", result.error);
        return null;
    }

    const imageId = result.data?.data ?? result.data;
    const normalized = imageId != null ? String(imageId).trim() : "";
    if (!isValidAlibabaImageId(normalized)) {
        console.warn("[1688] product.image.upload returned invalid imageId");
        return null;
    }
    return normalized;
};

const searchImageQuery = async ({
    imageAddress,
    imageId,
    imageBase64,
    beginPage = 1,
    pageSize = 32,
    country = "en",
    imageKeywords = "",
    categoryId,
    priceStart,
    priceEnd,
}) => {
    if (!client.isConfigured()) {
        console.error("Alibaba credentials are missing for image search.");
        return null;
    }

    const query = {
        beginPage: Number(beginPage) || 1,
        pageSize: Number(pageSize) || 32,
        country: String(country || "en").trim() || "en",
    };

    const keywordHint = String(imageKeywords || "").trim();
    if (keywordHint) {
        query.keyWord = keywordHint;
    }
    if (categoryId != null && categoryId !== "") {
        query.categoryId = categoryId;
    }
    if (priceStart != null && priceStart !== "") {
        query.priceStart = String(priceStart);
    }
    if (priceEnd != null && priceEnd !== "") {
        query.priceEnd = String(priceEnd);
    }

    if (imageId) {
        query.imageId = String(imageId);
    } else if (imageBase64) {
        query.imageBase64 = String(imageBase64).trim();
    } else if (imageAddress && typeof imageAddress === "string") {
        query.imageAddress = imageAddress.trim();
    } else {
        return null;
    }

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.search.imageQuery");
    const offerQueryParam = JSON.stringify(query);
    const result = await client.get(urlPath, { offerQueryParam });
    if (!result.ok) {
        console.warn("[1688] product.search.imageQuery failed:", result.error || "unknown");
        return null;
    }
    return result.data;
};

/** Domestic dropshipping image search — up to 10 visual matches (com.alibaba.product). */
const searchDomesticSimilarImageOffers = async ({
    imgUrl = "",
    imgBase64 = "",
    imageKeywords = "",
    priceStart,
    priceEnd,
    filter,
} = {}) => {
    if (!client.isConfigured()) return null;

    const params = {};
    const url = String(imgUrl || "").trim();
    const b64 = String(imgBase64 || "").trim();
    if (b64) {
        params.imgBase64 = b64.startsWith("data:") ? b64 : b64;
    } else if (url) {
        params.imgUrl = url;
    } else {
        return null;
    }

    const keywords = String(imageKeywords || "").trim();
    if (keywords) params.imageKeywords = keywords;
    if (priceStart != null && priceStart !== "") params.priceStart = String(priceStart);
    if (priceEnd != null && priceEnd !== "") params.priceEnd = String(priceEnd);
    if (Array.isArray(filter) && filter.length) params.filter = filter;

    const urlPath = client.urlPath(PRODUCT_NS, "alibaba.public.image.similar.offer.search");
    const result = await client.post(urlPath, params);
    if (!result.ok) {
        console.warn("[1688] alibaba.public.image.similar.offer.search failed:", result.error || "unknown");
        return null;
    }
    return result.data;
};

/** Multilingual same-product search (image + optional keyword). */
const searchSameOffers = async ({
    offerId,
    imageAddress,
    imageId,
    imageBase64,
    keyword = "",
    beginPage = 1,
    pageSize = 20,
    country = "en",
} = {}) => {
    if (!client.isConfigured() || !offerId) return null;

    const query = {
        offerId: String(offerId),
        beginPage: Number(beginPage) || 1,
        pageSize: Number(pageSize) || 20,
        country: String(country || "en").trim() || "en",
    };
    const keyWord = String(keyword || "").trim();
    if (keyWord) query.keyWord = keyWord;
    if (imageId) query.imageId = String(imageId);
    else if (imageBase64) query.imageBase64 = String(imageBase64).trim();
    else if (imageAddress) query.imageAddress = String(imageAddress).trim();

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.search.sameOffers");
    const offerQueryParam = JSON.stringify(query);
    const result = await client.get(urlPath, { offerQueryParam });
    if (!result.ok) {
        console.warn("[1688] product.search.sameOffers failed:", result.error || "unknown");
        return null;
    }
    return result.data;
};

/** Related / similar distribution offers for a seed offerId. */
const searchRelatedRecommend = async ({
    offerId,
    pageSize = 20,
    country = "en",
} = {}) => {
    if (!client.isConfigured() || !offerId) return null;

    const relatedQueryParam = JSON.stringify({
        offerId: String(offerId),
        pageSize: Number(pageSize) || 20,
        country: String(country || "en").trim() || "en",
    });

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.related.recommend");
    const result = await client.get(urlPath, { relatedQueryParam });
    if (!result.ok) {
        console.warn("[1688] product.related.recommend failed:", result.error || "unknown");
        return null;
    }
    return result.data;
};

/** Supply-side similar offer search (replacement / matching recommendations). */
const searchSimilarSupplyOffers = async ({
    offerId,
    pageSize = 20,
    country = "en",
} = {}) => {
    if (!client.isConfigured() || !offerId) return null;

    const param = JSON.stringify({
        offerId: String(offerId),
        pageSize: Number(pageSize) || 20,
        country: String(country || "en").trim() || "en",
    });

    const urlPath = client.urlPath(CROSSBORDER_NS, "supply.similarOffer.search");
    const result = await client.post(urlPath, { offerQueryParam: param });
    if (!result.ok) {
        console.warn("[1688] supply.similarOffer.search failed:", result.error || "unknown");
        return null;
    }
    return result.data;
};

const extractKeywordSearchOffers = (payload) => {
    if (!payload) return [];
    const candidates = [
        payload,
        payload?.data,
        payload?.searchOfferModelList,
        payload?.data?.searchOfferModelList,
        payload?.offerList,
        payload?.data?.offerList,
        payload?.result?.data,
    ];
    for (const list of candidates) {
        if (Array.isArray(list) && list.length) return list;
    }
    return [];
};

const searchOffersByKeywords = async ({
    keyword = "",
    keywords = [],
    beginPage = 1,
    pageSize = 20,
    country = "en",
} = {}) => {
    if (!client.isConfigured()) return [];

    const terms = [...new Set(
        [keyword, ...(Array.isArray(keywords) ? keywords : [])]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
    )].slice(0, 4);

    if (!terms.length) return [];

    const merged = [];
    const seen = new Set();

    for (const term of terms) {
        const result = await searchProductsQuery({
            keyword: term,
            beginPage: Number(beginPage) || 1,
            pageSize: Number(pageSize) || 20,
            country: String(country || "en").trim() || "en",
        });
        extractKeywordSearchOffers(result).forEach((row) => {
            const offerId = String(row?.offerId || row?.offer_id || row?.id || "").trim();
            if (!offerId || seen.has(offerId)) return;
            seen.add(offerId);
            merged.push(row);
        });
        if (merged.length >= pageSize) break;
    }

    return merged.slice(0, pageSize);
};

const searchProductsQuery = async ({
    keyword = "",
    beginPage = 1,
    pageSize = 20,
    country = "en",
}) => {
    if (!client.isConfigured()) {
        console.error("Alibaba credentials are missing for product.search.query.");
        return null;
    }

    const urlPath = client.urlPath(CROSSBORDER_NS, "product.search.query");
    const offerQueryParam = JSON.stringify({
        beginPage: Number(beginPage) || 1,
        pageSize: Number(pageSize) || 20,
        country: String(country || "en").trim() || "en",
        keyWord: String(keyword || "").trim(),
    });

    const result = await client.get(urlPath, { offerQueryParam });
    if (!result.ok) {
        console.warn("[1688] product.search.query failed:", result.error || keyword);
        return null;
    }
    return result.data;
};

const getAlibabaProduct = async (productID, opts = {}) => {
    if (!client.isConfigured()) {
        console.error("Alibaba credentials are missing for alibaba.product.get.");
        return null;
    }

    const id = productID != null ? Number(productID) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }

    const urlPath = client.urlPath(PRODUCT_NS, "alibaba.product.get");
    const params = { productID: String(id) };
    if (opts.webSite != null && opts.webSite !== "") {
        params.webSite = String(opts.webSite);
    }
    if (opts.scene != null && opts.scene !== "") {
        params.scene = String(opts.scene);
    }

    const result = await client.post(urlPath, params);
    if (!result.ok) return null;
    return normalizeAlibabaProductInfo(extractAlibabaProductGet(result.data), productID) || extractAlibabaProductGet(result.data);
};

module.exports = {
    getProductDetail,
    searchImageQuery,
    searchDomesticSimilarImageOffers,
    searchSameOffers,
    searchRelatedRecommend,
    searchSimilarSupplyOffers,
    uploadProductImage,
    extractImageSearchOffers,
    extractDomesticImageSearchOffers,
    extractKeywordSearchOffers,
    searchOffersByKeywords,
    mapOfferToProductStub,
    getAlibabaProduct,
    searchProductsQuery,
    isConfigured: () => client.isConfigured(),
};
