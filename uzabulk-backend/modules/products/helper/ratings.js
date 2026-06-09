const firstFiniteNumber = (values = []) => {
    for (const value of values) {
        if (value === undefined || value === null || value === "") continue;
        const numberValue = Number(value);
        if (Number.isFinite(numberValue)) return numberValue;
    }
    return null;
};

const normalizeRatingValue = (value) => {
    const rating = firstFiniteNumber([value]);
    if (rating === null || rating <= 0) return null;
    if (rating > 10 && rating <= 100) return Number((rating / 20).toFixed(1));
    if (rating > 5 && rating <= 10) return Number((rating / 2).toFixed(1));
    return Number(Math.min(rating, 5).toFixed(1));
};

/** 1688 / crossborder supplier score from product detail payload. */
const extractSupplierRatingStats = (productDetails = {}) => {
    const sellerData = productDetails.sellerDataInfo
        || productDetails.sellerData
        || productDetails.sellerInfo
        || {};

    const rating = normalizeRatingValue(firstFiniteNumber([
        productDetails.tradeScore,
        productDetails.score,
        productDetails.rating,
        productDetails.averageRating,
        productDetails.average_rating,
        productDetails.productRating,
        productDetails.productScore,
        productDetails?.statistics?.rating,
        productDetails?.statistics?.averageRating,
        productDetails?.reviewInfo?.averageRating,
        productDetails?.reviewInfo?.rating,
        sellerData.score,
        sellerData.tradeScore,
        sellerData.compositeScore,
    ]));

    const count = firstFiniteNumber([
        productDetails.ratingCount,
        productDetails.rating_count,
        productDetails.reviewCount,
        productDetails.reviewsCount,
        productDetails.evaluationCount,
        productDetails.productReviewCount,
        productDetails?.statistics?.ratingCount,
        productDetails?.statistics?.reviewCount,
        productDetails?.reviewInfo?.ratingCount,
        productDetails?.reviewInfo?.reviewCount,
        sellerData.ratingCount,
        sellerData.reviewCount,
    ]);

    return {
        average_rating: rating,
        rating_count: count !== null && count > 0 ? Math.floor(count) : 0,
    };
};

/** Aggregate approved UZA product reviews from MongoDB. */
const getLocalReviewRatingStats = async (productId) => {
    if (!productId || !_model?.productReview?.aggregate) {
        return { average_rating: null, rating_count: 0 };
    }

    const productKey = String(productId);

    const [stats] = await _model.productReview.aggregate([
        {
            $match: {
                product_id: productKey,
                status: "approved",
                rating: { $gt: 0 },
            },
        },
        {
            $group: {
                _id: "$product_id",
                average_rating: { $avg: "$rating" },
                rating_count: { $sum: 1 },
            },
        },
    ]);

    return {
        average_rating: normalizeRatingValue(stats?.average_rating),
        rating_count: Number(stats?.rating_count) || 0,
    };
};

const getProductReviewsList = async (productId, limit = 20) => {
    if (!productId || !_model?.productReview?.find) return [];

    return _model.productReview
        .find({
            product_id: String(productId),
            status: "approved",
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("reviewer rating review createdAt reviewer_email")
        .lean();
};

/**
 * UZA DB reviews first, then 1688 supplier rating cached on product, then legacy average_rating.
 */
const resolveProductRatingStats = (localStats, storedProduct = {}) => {
    if (localStats?.rating_count > 0 && localStats?.average_rating != null) {
        return {
            average_rating: localStats.average_rating,
            rating_count: localStats.rating_count,
            rating_source: "uza",
        };
    }

    const supplierRating = normalizeRatingValue(storedProduct.supplier_rating);
    const supplierCount = firstFiniteNumber([storedProduct.supplier_rating_count]) || 0;

    if (supplierRating != null) {
        return {
            average_rating: supplierRating,
            rating_count: supplierCount,
            rating_source: "supplier",
        };
    }

    const storedRating = normalizeRatingValue(storedProduct.average_rating);
    const storedCount = firstFiniteNumber([storedProduct.rating_count]) || 0;

    if (storedRating != null) {
        return {
            average_rating: storedRating,
            rating_count: storedCount,
            rating_source: storedCount > 0 ? "uza" : "supplier",
        };
    }

    return {
        average_rating: 0,
        rating_count: 0,
        rating_source: "none",
    };
};

const attachProductRatingFields = (item, ratingStats) => {
    if (!item || typeof item !== "object") return item;

    const stats = ratingStats || resolveProductRatingStats(
        { average_rating: null, rating_count: 0 },
        item
    );

    item.average_rating = stats.average_rating ?? 0;
    item.rating_count = stats.rating_count ?? 0;
    item.rating = stats.average_rating ?? 0;
    item.review_count = stats.rating_count ?? 0;
    item.rating_source = stats.rating_source || "none";

    return item;
};

/** Sync list/card responses using stored product + supplier fields. */
const attachProductRatingsFromStored = (item) => {
    if (!item || typeof item !== "object") return item;
    return attachProductRatingFields(
        item,
        resolveProductRatingStats({ average_rating: null, rating_count: 0 }, item)
    );
};

/** Product detail: DB reviews + ratings + review list. */
const attachSupplierVerificationFields = async (item) => {
    if (!item || typeof item !== "object") return item;

    try {
        const {
            findForProduct,
            toPublicVerification,
        } = require("../services/supplierVerificationService");
        const verification = await findForProduct(item);
        item.supplier_verification = toPublicVerification(verification);
        if (verification?.display_badge) {
            item.supplier_badge = verification.display_badge;
        }
        if (verification?.trust_score != null) {
            item.supplier_trust_score = verification.trust_score;
        }
    } catch (error) {
        item.supplier_verification = null;
    }

    return item;
};

const enrichProductReviewsAndRatings = async (item) => {
    if (!item?._id) return item;

    const [localStats, reviews] = await Promise.all([
        getLocalReviewRatingStats(item._id),
        getProductReviewsList(item._id),
    ]);

    const ratingStats = resolveProductRatingStats(localStats, item);
    attachProductRatingFields(item, ratingStats);
    item.reviews = reviews;
    item.has_uza_reviews = ratingStats.rating_source === "uza" && reviews.length > 0;

    await attachSupplierVerificationFields(item);

    return item;
};

module.exports = {
    extractSupplierRatingStats,
    getLocalReviewRatingStats,
    getProductReviewsList,
    resolveProductRatingStats,
    attachProductRatingFields,
    attachProductRatingsFromStored,
    attachSupplierVerificationFields,
    enrichProductReviewsAndRatings,
    normalizeRatingValue,
};
