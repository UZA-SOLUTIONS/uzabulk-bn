const firstNonEmptyString = (values = []) => {
    for (const value of values) {
        const text = value != null ? String(value).trim() : "";
        if (text) return text;
    }
    return "";
};

/**
 * Extract 1688 supplier / seller identifiers from product detail payload.
 */
const extractSupplierIds = (productDetails = {}) => {
    if (!productDetails || typeof productDetails !== "object") {
        return { sellerOpenId: "", seller_id: "", supplier_id: "" };
    }

    const sellerData = productDetails.sellerDataInfo
        || productDetails.sellerData
        || productDetails.sellerInfo
        || {};

    const sellerOpenId = firstNonEmptyString([
        productDetails.sellerOpenId,
        productDetails.sellerUserId,
        productDetails.sellerLoginId,
        sellerData.sellerOpenId,
        sellerData.openUid,
        sellerData.sellerLoginId,
        sellerData.loginId,
    ]);

    const seller_id = firstNonEmptyString([
        productDetails.seller_id,
        productDetails.sellerId,
        productDetails.sellerMemberId,
        productDetails.memberId,
        sellerData.sellerId,
        sellerData.memberId,
        sellerData.userId,
        sellerData.companyId,
        sellerOpenId,
    ]);

    const supplier_id = firstNonEmptyString([
        productDetails.supplier_id,
        productDetails.supplierId,
        seller_id,
        sellerOpenId,
    ]);

    return { sellerOpenId, seller_id, supplier_id };
};

const attachProductSupplierFields = (item) => {
    if (!item || typeof item !== "object") return item;

    const sellerOpenId = firstNonEmptyString([item.sellerOpenId, item.seller_open_id]);
    const seller_id = firstNonEmptyString([item.seller_id, item.sellerId, sellerOpenId]);
    const supplier_id = firstNonEmptyString([item.supplier_id, item.supplierId, seller_id, sellerOpenId]);

    if (sellerOpenId) item.sellerOpenId = sellerOpenId;
    if (seller_id) item.seller_id = seller_id;
    if (supplier_id) {
        item.supplier_id = supplier_id;
        item.supplierId = supplier_id;
        item.sellerId = seller_id || supplier_id;
    }

    return item;
};

module.exports = {
    extractSupplierIds,
    attachProductSupplierFields,
};
