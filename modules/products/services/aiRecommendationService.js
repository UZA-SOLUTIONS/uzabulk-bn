const Product = require("../../../models/productsTable");
const { isDashscopeConfigured } = require("../../ai/dashscopeClient");
const { cosineSimilarity } = require("../../ai/services/embeddingService");
const {
    ensureProductEmbedding,
    getSimilarProducts,
} = require("./similarProductsService");

const INTENT_EVENTS = new Set(["view", "add_to_cart", "update_cart", "checkout", "order"]);

const isAutoRecommendationsEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(env?.dashscope?.AUTO_RECOMMENDATIONS ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const collectSeedProductIds = (behaviors = [], max = 5) => {
    const ids = [];
    behaviors.forEach((behavior) => {
        if (!INTENT_EVENTS.has(behavior.eventType)) return;
        const id = String(behavior.product?._id || behavior.product || "").trim();
        if (!id || ids.includes(id)) return;
        ids.push(id);
    });
    return ids.slice(0, max);
};

const loadSeedVectors = async (seedIds = []) => {
    if (!seedIds.length) return [];

    const seeds = await Product.find({
        _id: { $in: seedIds },
        status: "active",
    })
        .select("embedding")
        .lean();

    const withVectors = seeds.filter(
        (row) => Array.isArray(row.embedding) && row.embedding.length > 0
    );

    if (withVectors.length) {
        return withVectors.map((row) => row.embedding);
    }

    const vectors = [];
    for (const id of seedIds.slice(0, 2)) {
        try {
            const vector = await ensureProductEmbedding(id);
            if (Array.isArray(vector) && vector.length) {
                vectors.push(vector);
            }
        } catch (error) {
            console.warn(`Seed embedding failed for ${id}:`, error.message);
        }
    }
    return vectors;
};

/**
 * Re-rank behavior-based recommendations using embedding similarity to recently viewed products.
 */
const applyEmbeddingBoost = async (rankedProducts = [], behaviors = []) => {
    if (!isAutoRecommendationsEnabled() || !rankedProducts.length) {
        return rankedProducts;
    }

    const seedIds = collectSeedProductIds(behaviors);
    if (!seedIds.length) return rankedProducts;

    const seedVectors = await loadSeedVectors(seedIds);
    if (!seedVectors.length) return rankedProducts;

    const candidateIds = rankedProducts.map((p) => p._id).filter(Boolean);
    const embeddingRows = await Product.find({
        _id: { $in: candidateIds },
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select("_id embedding")
        .lean();

    const embeddingById = new Map(
        embeddingRows.map((row) => [String(row._id), row.embedding])
    );

    const BOOST_WEIGHT = Number(env?.dashscope?.RECOMMENDATION_BOOST_WEIGHT || 4);

    const scored = rankedProducts.map((item, index) => {
        const behaviorRank = rankedProducts.length - index;
        const vector = embeddingById.get(String(item._id));
        let similarity = 0;

        if (Array.isArray(vector) && vector.length) {
            seedVectors.forEach((seedVector) => {
                const sim = cosineSimilarity(seedVector, vector);
                if (sim > similarity) similarity = sim;
            });
        }

        return {
            item,
            score: behaviorRank + similarity * BOOST_WEIGHT,
        };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .map((row) => row.item);
};

/**
 * Persist similar product ids on the catalog record (related_products).
 */
const ensureRelatedProducts = async (productId, { limit = 8 } = {}) => {
    if (!isAutoRecommendationsEnabled()) return [];

    const similar = await getSimilarProducts(productId, { limit });
    const relatedIds = similar
        .map((row) => row._id)
        .filter((id) => id && String(id) !== String(productId));

    if (!relatedIds.length) return [];

    await Product.updateOne(
        { _id: productId },
        { $set: { related_products: relatedIds } }
    );

    return relatedIds;
};

/**
 * Batch pre-compute related_products for catalog (nightly job).
 */
const backfillRelatedProducts = async ({ limit = 50 } = {}) => {
    if (!isAutoRecommendationsEnabled() || !isDashscopeConfigured()) {
        return { processed: 0, skipped: true };
    }

    const products = await Product.find({
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select("_id")
        .limit(Math.max(1, Math.min(limit, 200)))
        .lean();

    let processed = 0;
    let errors = 0;

    for (const product of products) {
        try {
            const relatedIds = await ensureRelatedProducts(product._id, { limit: 8 });
            if (relatedIds.length) processed += 1;
        } catch (error) {
            errors += 1;
            console.warn(`Related products backfill failed ${product._id}:`, error.message);
        }
    }

    return { processed, errors, scanned: products.length };
};

/**
 * Cold-start recommendations from catalog embeddings (no user behavior yet).
 */
const getEmbeddingDiscoveryProducts = async ({ limit = 24, seedKey = "" } = {}) => {
    if (!isAutoRecommendationsEnabled()) return [];

    const cap = Math.max(1, Math.min(Number(limit) || 24, 100));
    const dayKey = new Date().toISOString().slice(0, 10);
    const offsetSeed = [...String(seedKey), dayKey].join(":").length % 97;

    const anchors = await Product.find({
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select("_id embedding")
        .sort({ embedding_updated_at: -1, date_created_utc: -1 })
        .skip(offsetSeed)
        .limit(3)
        .lean();

    if (!anchors.length) return [];

    const pool = await Product.find({
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select("name price compare_price images featured_image average_rating rating_count short_description manage_stock stock_quantity stock_status isFeatured date_created_utc featureAttribute offerId categories sold_count embedding")
        .populate({ path: "featured_image", select: "link -_id" })
        .limit(400)
        .lean();

    const anchorVectors = anchors.map((a) => a.embedding);
    const scored = pool
        .map((item) => {
            let best = 0;
            anchorVectors.forEach((vector) => {
                const sim = cosineSimilarity(vector, item.embedding);
                if (sim > best) best = sim;
            });
            return { item, score: best };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score);

    const seen = new Set();
    const items = [];
    scored.forEach((row) => {
        const id = String(row.item._id);
        if (seen.has(id)) return;
        seen.add(id);
        items.push(row.item);
    });

    return items.slice(0, cap);
};

module.exports = {
    isAutoRecommendationsEnabled,
    applyEmbeddingBoost,
    ensureRelatedProducts,
    backfillRelatedProducts,
    getEmbeddingDiscoveryProducts,
};
