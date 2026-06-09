const firstPositiveInt = (values = []) => {
    for (const value of values) {
        if (value === undefined || value === null || value === "") continue;
        const numberValue = Number(value);
        if (Number.isFinite(numberValue) && numberValue > 0) {
            return Math.floor(numberValue);
        }
    }
    return null;
};

const getPriceRangeList = (productDetails = {}) => {
    const sale = productDetails.productSaleInfo || productDetails.saleInfo || {};
    const nested = productDetails.offerDetail || productDetails.productInfo || productDetails.detail || {};

    const lists = [
        sale.priceRangeList,
        productDetails.priceRangeList,
        productDetails.price_range,
        productDetails.priceRange,
        nested.productSaleInfo?.priceRangeList,
        nested.priceRangeList,
    ];

    for (const list of lists) {
        if (Array.isArray(list) && list.length) return list;
    }
    return [];
};

const getLowestTierQuantity = (priceRangeList = []) => {
    const tiers = Array.isArray(priceRangeList) ? [...priceRangeList] : [];
    if (!tiers.length) return null;

    tiers.sort((a, b) => {
        const aQty = Number(a?.startQuantity ?? a?.minQuantity ?? a?.quantity ?? a?.qty) || 0;
        const bQty = Number(b?.startQuantity ?? b?.minQuantity ?? b?.quantity ?? b?.qty) || 0;
        return aQty - bQty;
    });

    const firstTier = tiers[0] || {};
    return firstPositiveInt([
        firstTier.startQuantity,
        firstTier.minQuantity,
        firstTier.quantity,
        firstTier.qty,
    ]);
};

/**
 * Resolve MOQ from 1688 product detail / alibaba.product.get / crossborder detail payload.
 * Returns null when the API does not provide MOQ (no fake default).
 */
const extractMinOrderQty = (productDetails = {}) => {
    if (!productDetails || typeof productDetails !== "object") return null;

    const sale = productDetails.productSaleInfo || productDetails.saleInfo || {};
    const fenxiao = sale.fenxiaoSaleInfo || productDetails.fenxiaoSaleInfo || {};
    const priceRangeList = getPriceRangeList(productDetails);
    const tierMoq = getLowestTierQuantity(priceRangeList);

    return firstPositiveInt([
        productDetails.min_order_qty,
        productDetails.minOrderQuantity,
        productDetails.minimumOrderQuantity,
        productDetails.min_order_quantity,
        productDetails.batchNumber,
        sale.minOrderQuantity,
        sale.min_order_qty,
        sale.minOrderQty,
        sale.batchNumber,
        fenxiao.startQuantity,
        fenxiao.minOrderQuantity,
        tierMoq,
    ]);
};

/** Resolve MOQ from a stored UZA product document. */
const resolveProductMoq = (product = {}) => {
    const tierMoq = getLowestTierQuantity(product.price_tiers);

    return firstPositiveInt([
        tierMoq,
        product.min_order_qty,
        product.minQuantity,
        product.moq,
        product.minimumOrderQuantity,
        product.minOrderQuantity,
    ]);
};

/** Aliases used by API consumers (detail page + listing cards). */
const attachProductMoqFields = (item) => {
    if (!item || typeof item !== "object") return item;

    const moq = resolveProductMoq(item);
    if (moq == null) return item;

    item.min_order_qty = moq;
    item.minQuantity = moq;
    item.moq = moq;
    item.minimumOrderQuantity = moq;
    item.minOrderQuantity = moq;
    return item;
};

module.exports = {
    extractMinOrderQty,
    resolveProductMoq,
    attachProductMoqFields,
    getPriceRangeList,
    getLowestTierQuantity,
};
