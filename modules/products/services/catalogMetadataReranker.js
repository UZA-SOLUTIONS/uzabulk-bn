const Category = require("../../../models/categoryTable");
const { isDashscopeConfigured } = require("../../ai/services/embeddingService");
const { cosineSimilarity, getEmbedding } = require("../../ai/services/embeddingService");

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (value = "") =>
    normalizeTerm(value).split(" ").filter((word) => word.length > 2);

const STOP_WORDS = new Set([
    "the", "and", "with", "for", "from", "product", "products", "item", "items", "wholesale", "bulk",
]);

const buildVisionTokenSet = (vision = {}) => {
    const tokens = new Set();
    const add = (value) => {
        tokenize(value).forEach((word) => {
            if (!STOP_WORDS.has(word)) tokens.add(word);
        });
    };
    const attrs = vision.attributes || {};
    add(vision.primaryKeyword);
    add(vision.searchPhrase);
    add(vision.objectLabel);
    add(vision.featureSummary);
    (vision.keywords || []).forEach(add);
    add(attrs.product_type);
    add(attrs.category);
    add(attrs.color);
    add(attrs.material);
    add(attrs.shape);
    add(attrs.pattern);
    add(attrs.style);
    add(attrs.brand_or_logo);
    add(attrs.finish);
    add(attrs.size_hint);
    add(attrs.visible_text);
    add(attrs.use_case);
    add(attrs.packaging);
    (attrs.colors || []).forEach(add);
    (attrs.materials || []).forEach(add);
    (attrs.parts_and_components || []).forEach(add);
    (attrs.distinctive_features || []).forEach(add);
    (attrs.accessories_included || []).forEach(add);
    return tokens;
};

const scoreMetadataOverlap = (item = {}, visionTokens = new Set(), primaryKeyword = "") => {
    const fields = [
        item.name,
        item.short_description,
        ...(item.categoryNames || []),
        item.sku,
    ].filter(Boolean);

    if (!fields.length || !visionTokens.size) return 0;

    const itemText = normalizeTerm(fields.join(" "));
    const itemTokens = tokenize(itemText).filter((word) => !STOP_WORDS.has(word));
    if (!itemTokens.length) return 0;

    let overlap = 0;
    itemTokens.forEach((token) => {
        if (visionTokens.has(token)) overlap += 1;
    });

    const union = new Set([...visionTokens, ...itemTokens]).size || 1;
    let score = (overlap / union) * 45;

    const primary = normalizeTerm(primaryKeyword);
    const name = normalizeTerm(item.name || "");
    if (primary && name) {
        if (name === primary) score += 50;
        else if (name.startsWith(primary)) score += 28;
        else if (name.includes(primary)) score += 22;
    }

    visionTokens.forEach((token) => {
        if (token.length >= 4 && name.includes(token)) score += 4;
    });

    if (item.match_type === "visual" && overlap >= 2) score += 12;
    if (Number(item.similarity_score || 0) >= 0.55) score += 8;

    return Number(score.toFixed(4));
};

const enrichItemsWithCategoryNames = async (items = []) => {
    if (!Array.isArray(items) || !items.length) return [];

    const categoryIds = new Set();
    items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        (item.categories || []).forEach((id) => {
            const value = String(id?._id || id || "").trim();
            if (value) categoryIds.add(value);
        });
    });

    const nameById = new Map();
    if (categoryIds.size) {
        const rows = await Category.find({ _id: { $in: [...categoryIds] } })
            .select("catName")
            .lean();
        rows.forEach((row) => nameById.set(String(row._id), row.catName));
    }

    return items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const categoryNames = (item.categories || [])
            .map((id) => nameById.get(String(id?._id || id || "")))
            .filter(Boolean);
        return categoryNames.length ? { ...item, categoryNames } : item;
    });
};

let queryVectorCache = new Map();

const getQueryVector = async (phrase = "") => {
    const key = normalizeTerm(phrase);
    if (!key || !isDashscopeConfigured()) return null;
    if (queryVectorCache.has(key)) return queryVectorCache.get(key);
    try {
        const vector = await getEmbedding(key.slice(0, 2000));
        queryVectorCache.set(key, vector);
        while (queryVectorCache.size > 20) {
            queryVectorCache.delete(queryVectorCache.keys().next().value);
        }
        return vector;
    } catch (_) {
        return null;
    }
};

const rerankImageSearchItems = async (items = [], vision = null) => {
    if (!Array.isArray(items) || !items.length) return [];

    const visionTokens = buildVisionTokenSet(vision || {});
    const primaryKeyword = vision?.primaryKeyword || vision?.searchPhrase || "";

    const enriched = await enrichItemsWithCategoryNames(items);
    const semanticEnabled = String(process.env.IMAGE_SEARCH_METADATA_SEMANTIC ?? "true").toLowerCase() !== "false";
    const queryPhrase = String(vision?.searchPhrase || vision?.primaryKeyword || "").trim();
    const queryVector = semanticEnabled ? await getQueryVector(queryPhrase) : null;

    let working = enriched;
    if (queryVector) {
        const missingIds = enriched
            .filter((item) => item?._id && !Array.isArray(item.embedding))
            .map((item) => item._id);
        if (missingIds.length) {
            const Product = require("../../../models/productsTable");
            const rows = await Product.find({ _id: { $in: missingIds } })
                .select("embedding")
                .lean();
            const embeddingById = new Map(rows.map((row) => [String(row._id), row.embedding]));
            working = enriched.map((item) => ({
                ...item,
                embedding: item.embedding || embeddingById.get(String(item._id)),
            }));
        }
    }

    const reranked = working.map((item) => {
        const metadataScore = scoreMetadataOverlap(item, visionTokens, primaryKeyword);
        let semanticScore = 0;
        if (queryVector && Array.isArray(item.embedding) && item.embedding.length) {
            semanticScore = cosineSimilarity(queryVector, item.embedding) * 35;
        }

        const baseScore = Number(item.match_score || item.similarity_score || item._score || 0);
        const combined = Number((baseScore + metadataScore + semanticScore).toFixed(4));

        return {
            ...item,
            metadata_match_score: metadataScore,
            semantic_match_score: Number(semanticScore.toFixed(4)),
            match_score: combined,
        };
    });

    reranked.sort((a, b) => {
        const simA = Number(a.similarity_score || 0);
        const simB = Number(b.similarity_score || 0);
        const minSim = Math.min(
            Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_MIN_SIMILARITY || 0.38), 0),
            1
        );
        const visualA = simA >= minSim || (a.match_type === "visual" && simA > 0);
        const visualB = simB >= minSim || (b.match_type === "visual" && simB > 0);
        if (visualA && visualB) return simB - simA;
        if (visualA) return -1;
        if (visualB) return 1;
        return Number(b.match_score || 0) - Number(a.match_score || 0);
    });
    return reranked;
};

module.exports = {
    rerankImageSearchItems,
    enrichItemsWithCategoryNames,
    scoreMetadataOverlap,
};
