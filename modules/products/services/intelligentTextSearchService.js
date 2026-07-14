/**
 * Fast intelligent text search helpers:
 * - product-type relevance gating (avoid mixing t-shirts with lighting, etc.)
 * - visual/semantic similarity via text embeddings (same signal used for image search)
 * - hybrid re-rank of ES hits without scanning the whole catalog
 */
const Product = require("../../../models/productsTable");
const { isDashscopeConfigured, cosineSimilarity, getEmbedding } = require("../../ai/services/embeddingService");
const { searchProductsByVector } = require("./vectorSearchService");
const { normalizeTerm } = require("../../ai/services/aiTextSearchService");

const EMBEDDING_BOOST_ENABLED =
    String(process.env.SEARCH_EMBEDDING_BOOST ?? "true").toLowerCase() !== "false";
const EMBEDDING_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.SEARCH_EMBEDDING_TIMEOUT_MS || 1800), 600),
    4000
);
const SEMANTIC_FILL_LIMIT = Math.min(
    Math.max(Number(process.env.SEARCH_SEMANTIC_FILL_LIMIT || 24), 8),
    48
);
const SEMANTIC_CANDIDATE_LIMIT = Math.min(
    Math.max(Number(process.env.SEARCH_SEMANTIC_CANDIDATE_LIMIT || 220), 80),
    400
);

const COLOR_WORDS = new Set([
    "green", "red", "blue", "black", "white", "yellow", "pink", "purple", "orange",
    "brown", "grey", "gray", "gold", "silver", "beige", "navy", "khaki", "cream",
]);

/** Product families: must-have cues vs conflict cues (reduce mixed results). */
const PRODUCT_FAMILIES = {
    apparel: {
        must: [
            "t-shirt", "tshirt", "tee", "shirt", "polo", "hoodie", "sweatshirt", "jacket",
            "coat", "dress", "skirt", "pant", "jeans", "trouser", "short", "blouse",
            "top", "wear", "apparel", "clothing", "garment", "fabric", "cotton", "sleeve",
        ],
        never: [
            "led light", "led lamp", "light bulb", "bulb", "chandelier", "flashlight",
            "floodlight", "street light", "panel light", "lighting fixture", "desk lamp",
            "ceiling light", "downlight", "strip light",
        ],
    },
    lighting: {
        must: ["led", "lamp", "bulb", "light", "lighting", "lantern", "spotlight", "flashlight"],
        never: ["t-shirt", "tshirt", "hoodie", "jeans", "dress", "blouse", "sneaker"],
    },
    footwear: {
        must: ["shoe", "sneaker", "boot", "sandal", "slipper", "loafer", "footwear"],
        never: ["shirt", "lamp", "bulb", "phone case"],
    },
    bags: {
        must: ["bag", "tote", "backpack", "handbag", "purse", "luggage", "wallet"],
        never: ["led light", "lamp", "bulb", "t-shirt", "shirt"],
    },
    drinkware: {
        must: ["bottle", "cup", "mug", "tumbler", "flask", "glassware", "drinkware"],
        never: ["eyeglasses", "sunglasses", "phone"],
    },
    eyewear: {
        must: ["eyeglasses", "glasses", "sunglasses", "optical", "goggles", "spectacles"],
        never: ["wine glass", "drinking glass", "glass cup", "glass bottle"],
    },
};

const withTimeout = async (promise, timeoutMs, fallback = null) => {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(fallback), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

const itemKey = (item) => String(item?._id || item?.offerId || "");

const haystackOf = (item = {}) =>
    normalizeTerm(
        [
            item.name,
            item.title,
            item.short_description,
            item.sku,
            item.slug,
            ...(Array.isArray(item.categoryNames) ? item.categoryNames : []),
        ]
            .filter(Boolean)
            .join(" ")
    );

const includesAny = (text = "", needles = []) =>
    needles.some((needle) => needle && text.includes(normalizeTerm(needle)));

const resolveFamilyKey = (terms = {}) => {
    const hint = normalizeTerm(terms.categoryHint || terms.productType || terms.primary || "");
    if (!hint) return "";
    if (/(shirt|tee|hoodie|dress|apparel|cloth|garment|polo|jacket|pant|jean)/.test(hint)) {
        return "apparel";
    }
    if (/(light|lamp|led|bulb|lighting)/.test(hint)) return "lighting";
    if (/(shoe|sneaker|boot|footwear)/.test(hint)) return "footwear";
    if (/(bag|tote|backpack|handbag)/.test(hint)) return "bags";
    if (/(bottle|cup|mug|drinkware|glassware)/.test(hint) && !/eye/.test(hint)) return "drinkware";
    if (/(eyewear|eyeglass|sunglass|optical)/.test(hint)) return "eyewear";
    return "";
};

/**
 * Build an embedding phrase that captures visual intent (color, type, look)
 * so semantic search can behave like "imagine the product then match".
 */
const buildVisualSimilarityPhrase = (terms = {}, raw = "") => {
    const parts = [
        terms.userIntent,
        terms.exactPhrase,
        terms.primary,
        terms.productType,
        terms.correctedQuery,
        raw,
    ]
        .map((part) => String(part || "").trim())
        .filter(Boolean);

    const unique = [];
    const seen = new Set();
    parts.forEach((part) => {
        const key = normalizeTerm(part);
        if (!key || seen.has(key)) return;
        seen.add(key);
        unique.push(part);
    });

    const color = unique
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .find((token) => COLOR_WORDS.has(token));

    const visualBits = [
        unique[0] || raw,
        terms.productType,
        color ? `${color} colored` : "",
        "product photo appearance style look",
    ].filter(Boolean);

    return visualBits.join(" ").slice(0, 400);
};

/**
 * Drop / demote clearly off-family products (e.g. lighting in a t-shirt search).
 */
const filterByProductFamily = (items = [], terms = {}) => {
    const familyKey = resolveFamilyKey(terms);
    if (!familyKey || !PRODUCT_FAMILIES[familyKey]) {
        return { items, dropped: 0, familyKey: "" };
    }

    const family = PRODUCT_FAMILIES[familyKey];
    const kept = [];
    let dropped = 0;

    items.forEach((item) => {
        const hay = haystackOf(item);
        if (!hay) {
            kept.push(item);
            return;
        }

        const hasConflict = includesAny(hay, family.never);
        const hasMust = includesAny(hay, family.must);

        // Strong conflict + no apparel cues → drop (fixes shirt vs lighting mix).
        if (hasConflict && !hasMust) {
            dropped += 1;
            return;
        }

        // Soft demote conflicting items that somehow also matched a must token.
        if (hasConflict && hasMust) {
            kept.push({
                ...item,
                match_score: Number(item.match_score || 0) * 0.35,
                relevance_penalty: "family_conflict",
            });
            return;
        }

        kept.push(item);
    });

    return { items: kept, dropped, familyKey };
};

const attachEmbeddingsById = async (items = []) => {
    const missingIds = items
        .filter((item) => item?._id && !Array.isArray(item.embedding))
        .map((item) => item._id);
    if (!missingIds.length) return items;

    const rows = await Product.find({ _id: { $in: missingIds } })
        .select("embedding")
        .lean();
    const byId = new Map(rows.map((row) => [String(row._id), row.embedding]));

    return items.map((item) => ({
        ...item,
        embedding: item.embedding || byId.get(String(item._id)),
    }));
};

/**
 * Re-rank a small candidate set with query↔product embedding similarity (fast: $in only).
 */
const semanticRerankItems = async (items = [], visualPhrase = "") => {
    if (!EMBEDDING_BOOST_ENABLED || !items.length || !visualPhrase || !isDashscopeConfigured()) {
        return items;
    }

    const queryVector = await withTimeout(getEmbedding(visualPhrase), EMBEDDING_TIMEOUT_MS, null);
    if (!queryVector) return items;

    const withEmbeddings = await withTimeout(attachEmbeddingsById(items), EMBEDDING_TIMEOUT_MS, items);

    return withEmbeddings
        .map((item) => {
            let semantic = 0;
            if (Array.isArray(item.embedding) && item.embedding.length) {
                semantic = cosineSimilarity(queryVector, item.embedding);
            }
            const base = Number(item.match_score || item._score || item.similarity_score || 0);
            // Visual/semantic similarity dominates when names mismatch.
            const combined = base * 0.45 + semantic * 100;
            return {
                ...item,
                similarity_score: Number(semantic.toFixed(4)),
                match_score: Number(combined.toFixed(2)),
                match_type: semantic >= 0.42 ? "semantic_visual" : item.match_type || "text",
            };
        })
        .sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0));
};

/**
 * Fill weak / name-mismatch result sets with embedding neighbors (visual-like similarity).
 */
const semanticFillItems = async (terms = {}, raw = "", { limit = SEMANTIC_FILL_LIMIT, category } = {}) => {
    if (!EMBEDDING_BOOST_ENABLED || !isDashscopeConfigured()) return [];

    const phrase = buildVisualSimilarityPhrase(terms, raw);
    if (!phrase) return [];

    const queryVector = await withTimeout(getEmbedding(phrase), EMBEDDING_TIMEOUT_MS, null);
    if (!queryVector) return [];

    const filters = {};
    if (category) filters.categoryId = category;

    const rows = await withTimeout(
        searchProductsByVector(queryVector, filters, {
            limit,
            minScore: 0.28,
            candidateLimit: SEMANTIC_CANDIDATE_LIMIT,
            populateFeaturedImage: false,
        }),
        EMBEDDING_TIMEOUT_MS,
        []
    );

    return (rows || []).map((item) => ({
        ...item,
        match_type: "semantic_visual",
        match_score: Number((Number(item.similarity_score || 0) * 100).toFixed(2)),
    }));
};

/**
 * Decide whether ES/text hits are too weak / off-topic and need semantic fill.
 */
const needsSemanticFill = (items = [], terms = {}, raw = "") => {
    if (!items.length) return true;
    if (items.length < 4) return true;

    const primary = normalizeTerm(terms.primary || terms.productType || raw);
    const tokens = primary.split(" ").filter((t) => t.length > 2 && !COLOR_WORDS.has(t));
    if (!tokens.length) return false;

    const strongHits = items.filter((item) => {
        const hay = haystackOf(item);
        return tokens.some((token) => hay.includes(token));
    }).length;

    // Many results but almost none mention the product type → name mismatch / mixed bag.
    return strongHits / items.length < 0.35;
};

const mergeUniqueItems = (primary = [], secondary = [], limit = 32) => {
    const out = [];
    const seen = new Set();
    [...primary, ...secondary].forEach((item) => {
        const key = itemKey(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(item);
    });
    return out.slice(0, limit);
};

/**
 * Apply family filter + optional semantic fill + embedding re-rank.
 * Designed to finish quickly via short timeouts and small candidate sets.
 */
const applyIntelligentSearchLayer = async ({
    items = [],
    terms = {},
    raw = "",
    limit = 32,
    category,
    fast = false,
} = {}) => {
    const family = filterByProductFamily(items, terms);
    let working = family.items;

    const shouldFill =
        !fast &&
        EMBEDDING_BOOST_ENABLED &&
        needsSemanticFill(working, terms, raw);

    let semanticExtras = [];
    if (shouldFill) {
        semanticExtras = await semanticFillItems(terms, raw, {
            limit: Math.max(limit, SEMANTIC_FILL_LIMIT),
            category,
        });
        if (semanticExtras.length) {
            const filteredExtras = filterByProductFamily(semanticExtras, terms).items;
            working = mergeUniqueItems(working, filteredExtras, Math.max(limit * 2, 48));
        }
    }

    if (!fast && EMBEDDING_BOOST_ENABLED && working.length) {
        const phrase = buildVisualSimilarityPhrase(terms, raw);
        working = await semanticRerankItems(working.slice(0, Math.max(limit * 2, 48)), phrase);
        // Re-apply family filter after re-rank in case semantic brought soft conflicts up.
        working = filterByProductFamily(working, terms).items;
    }

    return {
        items: working.slice(0, limit),
        meta: {
            familyKey: family.familyKey || "",
            familyDropped: family.dropped || 0,
            semanticFilled: semanticExtras.length > 0,
            embeddingBoost: EMBEDDING_BOOST_ENABLED && !fast,
        },
    };
};

module.exports = {
    applyIntelligentSearchLayer,
    buildVisualSimilarityPhrase,
    filterByProductFamily,
    needsSemanticFill,
    PRODUCT_FAMILIES,
};
