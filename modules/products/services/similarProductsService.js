const Product = require("../../../models/productsTable");
const { isMongoConnected } = require("../../../config/db");
const {
    getEmbedding,
    buildProductEmbeddingText,
    isDashscopeConfigured,
} = require("../../ai/services/embeddingService");
const { buildAttributesEmbeddingText } = require("../../ai/helpers/productAttributes");
const {
    searchProductsByVector,
    productListProjection,
} = require("./vectorSearchService");
const { buildPriceBandFromCny } = require("../../ai/helpers/productAttributes");

/**
 * Compute and persist embedding for one product (background-safe).
 */
const ensureProductEmbedding = async (productId, { force = false } = {}) => {
    if (!isDashscopeConfigured() || !isMongoConnected()) return null;

    const product = await Product.findById(productId)
        .select("name short_description description categories pricingType embedding embedding_updated_at status meta_data seoSettings")
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
 * Similar products via stored embedding + category/price/supplier filters.
 */
const getSimilarProducts = async (productId, {
    limit = 6,
    minPrice,
    maxPrice,
    minSupplierRating,
} = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 6, 24));
    if (!isMongoConnected()) return [];

    const source = await Product.findById(productId)
        .select({
            ...productListProjection,
            description: 1,
            pricingType: 1,
            status: 1,
            topCategoryId: 1,
        })
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

    const priceBand = buildPriceBandFromCny(source.price);
    const filters = {
        excludeId: source._id,
        categoryId: source.topCategoryId || null,
        minPrice: minPrice ?? priceBand?.minPrice,
        maxPrice: maxPrice ?? priceBand?.maxPrice,
        minSupplierRating: minSupplierRating ?? undefined,
    };

    let results = await searchProductsByVector(queryVector, filters, {
        limit: cap,
        minScore: 0.12,
    });

    if (results.length < cap) {
        const relaxed = await searchProductsByVector(queryVector, {
            excludeId: source._id,
            minSupplierRating: filters.minSupplierRating,
        }, {
            limit: cap,
            minScore: 0.1,
        });
        const seen = new Set(results.map((row) => String(row._id)));
        relaxed.forEach((row) => {
            const key = String(row._id);
            if (!seen.has(key)) {
                seen.add(key);
                results.push(row);
            }
        });
        results = results.slice(0, cap);
    }

    return results;
};

/**
 * Embed buyer-upload image attributes directly (Flow A step 3).
 */
const searchByAttributeEmbedding = async (attributes, filters = {}, { limit = 10 } = {}) => {
    const text = buildAttributesEmbeddingText(attributes);
    if (!text || !isDashscopeConfigured()) return [];

    const queryVector = await getEmbedding(text.slice(0, 2000));
    return searchProductsByVector(queryVector, filters, { limit, minScore: 0.15 });
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
        .select("name short_description description categories pricingType meta_data seoSettings")
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
    searchByAttributeEmbedding,
    backfillProductEmbeddings,
};
