const Product = require("../../../models/productsTable");
const { isMongoConnected } = require("../../../config/db");
const {
    getEmbedding,
    buildProductEmbeddingText,
    cosineSimilarity,
    isDashscopeConfigured,
} = require("../../ai/services/embeddingService");
const { attachProductRatingsFromStored } = require("../helper/ratings");

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
    offerId: 1,
    slug: 1,
    embedding: 1,
    embedding_updated_at: 1,
};

/**
 * Compute and persist embedding for one product (background-safe).
 */
const ensureProductEmbedding = async (productId, { force = false } = {}) => {
    if (!isDashscopeConfigured() || !isMongoConnected()) return null;

    const product = await Product.findById(productId)
        .select("name short_description description categories pricingType embedding embedding_updated_at status")
        .lean();

    if (!product || product.status !== "active") return null;
    if (!force && Array.isArray(product.embedding) && product.embedding.length > 0) {
        return product.embedding;
    }

    const text = buildProductEmbeddingText(product);
    const vector = await getEmbedding(text);

    await Product.updateOne(
        { _id: productId },
        { $set: { embedding: vector, embedding_updated_at: new Date() } }
    );

    return vector;
};

/**
 * Similar products via cosine similarity on stored embeddings.
 */
const getSimilarProducts = async (productId, { limit = 6 } = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 6, 24));
    if (!isMongoConnected()) return [];

    const source = await Product.findById(productId)
        .select({ ...productListProjection, description: 1, pricingType: 1, status: 1 })
        .lean();

    if (!source || source.status !== "active") {
        return [];
    }

    let queryVector = source.embedding;
    if (!Array.isArray(queryVector) || !queryVector.length) {
        if (!isDashscopeConfigured()) return [];
        try {
            queryVector = await ensureProductEmbedding(productId);
        } catch (error) {
            console.warn(`Embedding failed for product ${productId}:`, error.message);
            return [];
        }
    }
    if (!queryVector?.length) return [];

    const candidates = await Product.find({
        _id: { $ne: source._id },
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select(productListProjection)
        .limit(500)
        .lean();

    const scored = candidates
        .map((item) => ({
            item,
            score: cosineSimilarity(queryVector, item.embedding),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, cap);

    return scored.map((row) => {
        const doc = attachProductRatingsFromStored({ ...row.item });
        doc.similarity_score = Number(row.score.toFixed(4));
        return doc;
    });
};

/**
 * Batch backfill embeddings for catalog (cron / script).
 */
const backfillProductEmbeddings = async ({ limit = 50, force = false } = {}) => {
    if (!isDashscopeConfigured() || !isMongoConnected()) {
        return { processed: 0, skipped: true };
    }

    const query = { status: "active" };
    if (!force) {
        query.$or = [
            { embedding: { $exists: false } },
            { embedding: { $size: 0 } },
            { embedding: null },
        ];
    }

    const products = await Product.find(query)
        .select("name short_description description categories pricingType")
        .limit(Math.max(1, Math.min(limit, 200)))
        .lean();

    let processed = 0;
    let errors = 0;

    for (const product of products) {
        try {
            const text = buildProductEmbeddingText(product);
            const vector = await getEmbedding(text);
            await Product.updateOne(
                { _id: product._id },
                { $set: { embedding: vector, embedding_updated_at: new Date() } }
            );
            processed += 1;
        } catch (error) {
            errors += 1;
            console.warn(`Embedding backfill failed ${product._id}:`, error.message);
        }
    }

    return { processed, errors, scanned: products.length };
};

module.exports = {
    ensureProductEmbedding,
    getSimilarProducts,
    backfillProductEmbeddings,
};
