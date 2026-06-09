const { fetchSupplierProfileFrom1688 } = require("./alibabaSupplier");
const { extractSupplierIds } = require("../helper/supplier");
const {
    buildVerificationRecord,
    needsRefresh,
    toPublicVerification,
    normalizeSupplierApiPayload,
} = require("../helper/supplierVerification");

const resolveMemberId = (supplierIds = {}, productDetails = {}) => {
    const ids = supplierIds && typeof supplierIds === "object"
        ? supplierIds
        : extractSupplierIds(productDetails);

    return (
        String(ids.sellerOpenId || ids.supplier_id || ids.seller_id || "").trim()
        || String(
            productDetails?.sellerOpenId
            || productDetails?.sellerUserId
            || productDetails?.sellerDataInfo?.sellerOpenId
            || ""
        ).trim()
    );
};

const getSupplierVerificationModel = () => _model?.SupplierVerification;

/**
 * Run 1688 member + company APIs and upsert SupplierVerification.
 * @param {{ memberId?: string, sellerOpenId?: string, seller_id?: string, supplier_id?: string, productDetails?: object, force?: boolean }}
 */
const verifySupplier = async ({
    memberId,
    sellerOpenId,
    seller_id,
    supplier_id,
    productDetails = {},
    force = false,
} = {}) => {
    const Model = getSupplierVerificationModel();
    if (!Model) {
        console.warn("SupplierVerification model not loaded");
        return null;
    }

    const resolvedMemberId = resolveMemberId(
        { sellerOpenId, seller_id, supplier_id, sellerOpenId: memberId || sellerOpenId },
        productDetails
    );

    if (!resolvedMemberId) {
        return null;
    }

    const existing = await Model.findOne({ member_id: resolvedMemberId }).lean();
    if (existing && !force && !needsRefresh(existing)) {
        return existing;
    }

    let member = {};
    let company = {};
    let last_error = "";

    try {
        const apiData = await fetchSupplierProfileFrom1688(resolvedMemberId);
        member = apiData?.member || {};
        company = apiData?.company || {};
        if (!apiData?.member && !apiData?.company) {
            last_error = "1688 member/company API returned no data";
        }
    } catch (error) {
        last_error = error?.message || "1688 supplier API failed";
        console.warn(`Supplier verification API failed for ${resolvedMemberId}:`, last_error);
    }

    const record = buildVerificationRecord({
        memberId: resolvedMemberId,
        sellerOpenId: sellerOpenId || resolvedMemberId,
        seller_id,
        supplier_id: supplier_id || resolvedMemberId,
        member,
        company,
        productDetails,
    });

    if (last_error) {
        record.last_error = last_error;
        if (!record.company_name && !record.credit_level) {
            const fallback = normalizeSupplierApiPayload({ productDetails });
            Object.assign(record, {
                company_name: fallback.company_name || record.company_name,
                credit_level: fallback.credit_level || record.credit_level,
                years_on_platform: fallback.years_on_platform ?? record.years_on_platform,
                transaction_count_90d:
                    fallback.transaction_count_90d ?? record.transaction_count_90d,
                on_time_delivery_rate:
                    fallback.on_time_delivery_rate ?? record.on_time_delivery_rate,
                dispute_rate: fallback.dispute_rate ?? record.dispute_rate,
                product_categories: fallback.product_categories?.length
                    ? fallback.product_categories
                    : record.product_categories,
            });
        }
    }

    const saved = await Model.findOneAndUpdate(
        { member_id: resolvedMemberId },
        { $set: record },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (saved?.manual_review_required) {
        console.warn(
            `[supplier-verification] Manual review: member=${resolvedMemberId} score=${saved.trust_score}`
        );
    }

    return saved;
};

/** Called on first product import / sync when 1688 product detail is available. */
const verifyFromProductDetails = async (productDetails, supplierIds = {}) => {
    const memberId = resolveMemberId(supplierIds, productDetails);
    if (!memberId) return null;

    return verifySupplier({
        memberId,
        sellerOpenId: supplierIds.sellerOpenId || memberId,
        seller_id: supplierIds.seller_id,
        supplier_id: supplierIds.supplier_id,
        productDetails,
        force: false,
    });
};

const findByMemberId = async (memberId) => {
    const Model = getSupplierVerificationModel();
    if (!Model || !memberId) return null;
    return Model.findOne({ member_id: String(memberId).trim() }).lean();
};

const findForProduct = async (product = {}) => {
    const memberId = resolveMemberId(
        {
            sellerOpenId: product.sellerOpenId,
            seller_id: product.seller_id,
            supplier_id: product.supplier_id,
        },
        product
    );
    if (!memberId) return null;
    return findByMemberId(memberId);
};

/**
 * Refresh suppliers whose next_refresh_at is due (30-day cycle).
 */
const refreshStaleSuppliers = async ({ limit = 50 } = {}) => {
    const Model = getSupplierVerificationModel();
    if (!Model) return { refreshed: 0, errors: 0 };

    const now = new Date();
    const stale = await Model.find({
        $or: [
            { next_refresh_at: { $lte: now } },
            { next_refresh_at: null },
            { last_verified_at: null },
        ],
    })
        .sort({ last_verified_at: 1 })
        .limit(Math.max(1, Math.min(limit, 200)))
        .lean();

    let refreshed = 0;
    let errors = 0;

    for (const row of stale) {
        try {
            await verifySupplier({
                memberId: row.member_id,
                sellerOpenId: row.sellerOpenId,
                seller_id: row.seller_id,
                supplier_id: row.supplier_id,
                force: true,
            });
            refreshed += 1;
        } catch (error) {
            errors += 1;
            console.warn(`Refresh failed for ${row.member_id}:`, error.message);
        }
    }

    return { refreshed, errors, scanned: stale.length };
};

/**
 * Discover unique suppliers from active catalog and verify missing/stale rows.
 */
const verifySuppliersFromCatalog = async ({ limit = 30 } = {}) => {
    if (!_model?.Product) return { verified: 0 };

    const suppliers = await _model.Product.aggregate([
        { $match: { status: "active", supplier_id: { $exists: true, $ne: "" } } },
        {
            $group: {
                _id: {
                    member_id: {
                        $ifNull: [
                            "$sellerOpenId",
                            { $ifNull: ["$supplier_id", "$seller_id"] },
                        ],
                    },
                },
                sellerOpenId: { $first: "$sellerOpenId" },
                seller_id: { $first: "$seller_id" },
                supplier_id: { $first: "$supplier_id" },
            },
        },
        { $limit: Math.max(1, Math.min(limit, 100)) },
    ]);

    let verified = 0;
    for (const row of suppliers) {
        const memberId = String(row._id?.member_id || "").trim();
        if (!memberId) continue;
        const existing = await findByMemberId(memberId);
        if (existing && !needsRefresh(existing)) continue;

        await verifySupplier({
            memberId,
            sellerOpenId: row.sellerOpenId || memberId,
            seller_id: row.seller_id,
            supplier_id: row.supplier_id,
            force: false,
        });
        verified += 1;
    }

    return { verified, scanned: suppliers.length };
};

module.exports = {
    resolveMemberId,
    verifySupplier,
    verifyFromProductDetails,
    findByMemberId,
    findForProduct,
    refreshStaleSuppliers,
    verifySuppliersFromCatalog,
    toPublicVerification,
    needsRefresh,
};
