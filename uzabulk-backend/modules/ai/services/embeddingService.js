const { getDashscopeClient, isDashscopeConfigured } = require("../dashscopeClient");

const EMBEDDING_MODEL = () => env?.dashscope?.EMBEDDING_MODEL || "text-embedding-v3";
const EMBEDDING_DIMENSIONS = () =>
    Number(env?.dashscope?.EMBEDDING_DIMENSIONS || 1024);

/**
 * DashScope OpenAI-compatible embeddings API.
 */
const getEmbedding = async (text) => {
    if (!isDashscopeConfigured()) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    const input = String(text || "").trim();
    if (!input) throw new Error("text is required for embedding");

    const client = getDashscopeClient();
    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL(),
        input,
        dimensions: EMBEDDING_DIMENSIONS(),
    });

    const vector = response?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || !vector.length) {
        throw new Error("Embedding API returned empty vector");
    }
    return vector;
};

const buildProductEmbeddingText = (product = {}) => {
    const parts = [
        product.name,
        product.short_description,
        product.description,
        Array.isArray(product.categories) ? product.categories.join(" ") : "",
        product.pricingType,
    ].filter(Boolean);
    return parts.join(" ").slice(0, 8000);
};

const cosineSimilarity = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return 0;
    }
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i += 1) {
        const x = Number(a[i]) || 0;
        const y = Number(b[i]) || 0;
        dot += x * y;
        magA += x * x;
        magB += y * y;
    }
    if (!magA || !magB) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

module.exports = {
    getEmbedding,
    buildProductEmbeddingText,
    cosineSimilarity,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
    isDashscopeConfigured,
};
