const Product = require("../../../models/productsTable");
const { isMongoConnected } = require("../../../config/db");
const { cosineSimilarity } = require("../../ai/services/embeddingService");
const { attachProductRatingsFromStored } = require("../helper/ratings");

const DEFAULT_MIN_SUPPLIER_RATING = Number(process.env.VECTOR_SEARCH_MIN_SUPPLIER_RATING || 3.5);
const CANDIDATE_LIMIT = Math.min(
    Math.max(Number(process.env.VECTOR_SEARCH_CANDIDATE_LIMIT || 800), 200),
    1500
);

const productListProjection = {
    name: 1,
    price: 1,
    compare_price: 1,
    images: 1,
    featured_image: 1,
    average_rating: 1,
    rating_count: 1,
    short_description: 1,
    categories: 1,
    topCategoryId: 1,
    offerId: 1,
    slug: 1,
    embedding: 1,
    supplier_rating: 1,
};

const buildMongoFilter = ({
    excludeId,
    categoryId,
    minPrice,
    maxPrice,
    minSupplierRating = DEFAULT_MIN_SUPPLIER_RATING,
    requireSupplierRating = false,
} = {}) => {
    const filter = {
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    };

    if (excludeId) {
        filter._id = { $ne: excludeId };
    }

    if (categoryId) {
        filter.$or = [
            { topCategoryId: categoryId },
            { categories: categoryId },
        ];
    }

    if (minPrice != null || maxPrice != null) {
        filter.price = {};
        if (minPrice != null) filter.price.$gte = minPrice;
        if (maxPrice != null) filter.price.$lte = maxPrice;
    }

    if (minSupplierRating != null) {
        if (requireSupplierRating) {
            filter.supplier_rating = { $gte: minSupplierRating };
        } else {
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { supplier_rating: { $gte: minSupplierRating } },
                        { supplier_rating: { $exists: false } },
                        { supplier_rating: null },
                    ],
                },
            ];
        }
    }

    return filter;
};

/**
 * Vector similarity search with catalog SQL-style filters (category, price, supplier rating).
 */
const searchProductsByVector = async (
    queryVector,
    filters = {},
    {
        limit = 10,
        minScore = 0.15,
        candidateLimit = CANDIDATE_LIMIT,
        populateFeaturedImage = true,
    } = {}
) => {
    const cap = Math.max(1, Math.min(Number(limit) || 10, 48));
    if (!isMongoConnected()) return [];
    if (!Array.isArray(queryVector) || !queryVector.length) return [];

    let query = Product.find(buildMongoFilter(filters))
        .select(productListProjection)
        .limit(candidateLimit);

    if (populateFeaturedImage) {
        query = query.populate({ path: "featured_image", select: "link -_id" });
    }

    const candidates = await query.lean();

    return candidates
        .map((item) => ({
            item,
            score: cosineSimilarity(queryVector, item.embedding),
        }))
        .filter((row) => row.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, cap)
        .map((row) => {
            const doc = attachProductRatingsFromStored({ ...row.item });
            doc.similarity_score = Number(row.score.toFixed(4));
            return doc;
        });
};

module.exports = {
    DEFAULT_MIN_SUPPLIER_RATING,
    CANDIDATE_LIMIT,
    buildMongoFilter,
    searchProductsByVector,
    productListProjection,
};
