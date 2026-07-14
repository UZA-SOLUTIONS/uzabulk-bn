const Product = require("../../../models/productsTable");
const esProductService = require("./esProductService");
const { expandSearchQuery, basicQueryCleanup, normalizeTerm } = require("../../ai/services/aiTextSearchService");
const { getElasticsearchAvailability } = require("../../../elasticsearch/availability");
const { withMongoMaxTime } = require("../../../utils/mongoQueryOptions");
const { applyIntelligentSearchLayer } = require("./intelligentTextSearchService");

const SEARCH_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.SEARCH_SOURCE_TIMEOUT_MS || 8000), 3000),
    15000
);
const MONGO_SEARCH_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.SEARCH_MONGO_TIMEOUT_MS || 2500), 1500),
    6000
);
const IMAGE_SEARCH_BATCH_LIMIT = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_BATCH_LIMIT || 100), 60),
    160
);
const CATALOG_BATCH_LIMIT = Math.min(
    Math.max(Number(process.env.SEARCH_CATALOG_BATCH_LIMIT || 400), 120),
    800
);
const REMOTE_MONGO_SEARCH = String(process.env.SEARCH_REMOTE_MONGO ?? "true").toLowerCase() !== "false";
/** 1688 text-search fallback is off by default — catalog + ES only. Set SEARCH_INCLUDE_1688=true to enable. */
const SEARCH_INCLUDE_1688 = String(process.env.SEARCH_INCLUDE_1688 ?? "false").toLowerCase() === "true";
/** Image search uses local Elasticsearch when available (same index as text search). */
const IMAGE_SEARCH_USE_ES = String(process.env.IMAGE_SEARCH_USE_ELASTICSEARCH ?? "true").toLowerCase() !== "false";
const IMAGE_SEARCH_ES_MAX_NEEDLES = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_ES_MAX_NEEDLES || 3), 1),
    5
);
const ALIBABA_SEARCH_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.SEARCH_ALIBABA_TIMEOUT_MS || 6000), 3000),
    12000
);

const listProjection = {
    name: 1,
    price: 1,
    compare_price: 1,
    images: 1,
    featured_image: 1,
    average_rating: 1,
    rating_count: 1,
    short_description: 1,
    offerId: 1,
    slug: 1,
    sku: 1,
    categories: 1,
    sold_count: 1,
    bestSeller: 1,
    isFeatured: 1,
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const sanitizeSearchItem = (item = {}) => {
    const clean = { ...item };
    delete clean.match_type;
    delete clean.match_score;
    delete clean.similarity_score;
    delete clean._score;
    return clean;
};

const singularize = (term = "") => {
    const t = normalizeTerm(term);
    if (t.endsWith("ies") && t.length > 4) return `${t.slice(0, -3)}y`;
    if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
    if (t.endsWith("s") && t.length > 3) return t.slice(0, -1);
    return t;
};

const pluralize = (term = "") => {
    const t = normalizeTerm(term);
    if (!t) return t;
    if (t.endsWith("s")) return t;
    if (t.endsWith("y") && t.length > 2) return `${t.slice(0, -1)}ies`;
    return `${t}s`;
};

const buildSearchVariants = (raw = "", terms = {}) => {
    const seen = new Set();
    const out = [];
    const add = (value) => {
        const term = normalizeTerm(value);
        if (!term || term.length < 2 || seen.has(term)) return;
        seen.add(term);
        out.push(term);
    };

    const normalizedRaw = normalizeTerm(raw);
    const primary = normalizeTerm(terms.primary || "");
    const eyewearIntent =
        ["glasses", "glasse", "eyeglasses", "sunglasses"].includes(normalizedRaw) ||
        primary === "eyeglasses" ||
        terms.categoryHint === "eyewear";
    const drinkwareIntent =
        normalizedRaw === "glass" ||
        primary === "drinking glass" ||
        terms.categoryHint === "drinkware";

    add(raw);
    add(terms.primary);
    add(terms.correctedQuery);
    add(terms.exactPhrase);
    if (Array.isArray(terms.keywords)) terms.keywords.slice(0, 4).forEach(add);

    [...out].forEach((term) => {
        if (eyewearIntent && term === "glasses") return;
        add(singularize(term));
        add(pluralize(term));
    });

    if (eyewearIntent) {
        ["eyeglasses", "sunglasses", "reading glasses", "optical glasses", "safety glasses"].forEach(add);
    } else if (drinkwareIntent) {
        ["drinking glass", "wine glass", "glass cup", "glassware"].forEach(add);
    }

    const filtered = eyewearIntent ? out.filter((term) => term !== "glass" && term !== "glasse") : out;
    return filtered.slice(0, 8);
};

const tokenize = (value = "") => normalizeTerm(value).split(" ").filter((t) => t.length > 1);

const scoreItemForQuery = (item, terms = {}, variants = []) => {
    const name = normalizeTerm(item?.name || item?.title || "");
    const sku = normalizeTerm(item?.sku || "");
    const desc = normalizeTerm(item?.short_description || "");
    const primary = normalizeTerm(terms.primary || "");
    const exact = normalizeTerm(terms.exactPhrase || terms.primary || "");
    const original = normalizeTerm(terms.original || "");
    const corrected = normalizeTerm(terms.correctedQuery || "");

    let score = Number(item?._score || item?.match_score || 0);
    if (!name) return score;

    if (exact && (name === exact || sku === exact)) score += 140;
    if (primary && name === primary) score += 120;
    if (original && name === original) score += 100;
    if (corrected && name === corrected) score += 90;
    if (primary && name.startsWith(primary)) score += 55;
    if (exact && name.includes(exact)) score += 50;
    if (primary && name.includes(primary)) score += 45;
    if (original && name.includes(original)) score += 40;

    variants.forEach((variant, index) => {
        if (!variant) return;
        if (name === variant) score += Math.max(20, 70 - index * 8);
        else if (name.startsWith(variant)) score += Math.max(12, 45 - index * 6);
        else if (name.includes(variant)) score += Math.max(8, 35 - index * 5);
        else if (desc.includes(variant)) score += 6;
    });

    const primaryTokens = tokenize(primary || exact || original);
    if (primaryTokens.length) {
        const nameTokens = new Set(tokenize(name));
        const matched = primaryTokens.filter((t) => nameTokens.has(t)).length;
        score += (matched / primaryTokens.length) * 35;
    }

    const ratingCount = Number(item?.rating_count || 0);
    const averageRating = Number(item?.average_rating || 0);
    const soldCount = Number(item?.sold_count || 0);
    if (ratingCount > 0) score += Math.min(ratingCount / 35, 15);
    if (averageRating > 0) score += averageRating * 2;
    if (soldCount > 0) score += Math.min(soldCount / 50, 12);
    if (item?.bestSeller) score += 8;
    if (item?.isFeatured) score += 4;

    return score;
};

const rankSearchResults = (items = [], terms = {}, variants = []) =>
    [...items]
        .map((item) => ({
            ...item,
            match_score: Number(scoreItemForQuery(item, terms, variants).toFixed(2)),
        }))
        .sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0));

const buildMongoCategoryFilter = (category) => {
    if (!category) return {};
    const id = String(category).trim();
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return {};
    return { categories: id };
};

const IMAGE_SEARCH_STOP_WORDS = new Set([
    "wholesale", "bulk", "purchase", "resale", "buy", "selling", "sell", "for",
    "the", "and", "with", "from", "shop", "store", "b2b", "trade", "supplier",
    "smartphones", "smartphone", "phones", "phone", "mobile", "device", "devices",
    "product", "products", "item", "items", "goods", "merchandise", "commercial",
    "in", "on", "at", "to", "of", "by", "or", "an", "a",
]);

const GENERIC_NEEDLE_TERMS = new Set([
    "silver", "gold", "black", "white", "blue", "red", "green", "grey", "gray",
    "electronics", "electronic", "accessories", "accessory", "general", "other",
    "new", "hot", "best", "quality", "high", "premium", "original", "genuine",
    "color", "colour", "style", "fashion", "portable", "mini", "small", "large",
    "gray", "grey",
]);

const distillCatalogTerm = (value = "") => {
    const words = normalizeTerm(value)
        .split(" ")
        .filter((word) => word.length > 1 && !IMAGE_SEARCH_STOP_WORDS.has(word));
    return words.join(" ").trim();
};

/** Short product-name needles for image search (built from scanned visual features). */
const buildImageSearchCatalogNeedles = ({
    primaryKeyword = "",
    searchPhrase = "",
    objectLabel = "",
    keywords = [],
    categoryHint = "",
    attributes = {},
} = {}) => {
    const needles = [];
    const seen = new Set();
    const add = (value) => {
        const distilled = distillCatalogTerm(value);
        if (!distilled || distilled.length < 3 || seen.has(distilled)) return;
        seen.add(distilled);
        needles.push(distilled);
    };

    const attrs = attributes && typeof attributes === "object" ? attributes : {};
    const colors = Array.isArray(attrs.colors) ? attrs.colors : (attrs.color ? [attrs.color] : []);
    const materials = Array.isArray(attrs.materials) ? attrs.materials : (attrs.material ? [attrs.material] : []);
    const distinctive = Array.isArray(attrs.distinctive_features) ? attrs.distinctive_features : [];
    const parts = Array.isArray(attrs.parts_and_components) ? attrs.parts_and_components : [];

    add(primaryKeyword);
    add(objectLabel);
    add(attrs.product_type);
    add(attrs.brand_or_logo);
    add(categoryHint || attrs.category);
    (Array.isArray(keywords) ? keywords : []).slice(0, 12).forEach(add);
    distinctive.slice(0, 6).forEach(add);
    parts.slice(0, 4).forEach(add);
    add(attrs.style);
    add(attrs.pattern);
    add(attrs.shape);
    add(attrs.finish);
    add(attrs.visible_text);
    add(attrs.use_case);

    const productType = distillCatalogTerm(attrs.product_type || primaryKeyword || objectLabel);
    colors.slice(0, 3).forEach((color) => {
        add(color);
        if (productType) add(`${color} ${productType}`);
    });
    materials.slice(0, 3).forEach((material) => {
        add(material);
        if (productType) add(`${material} ${productType}`);
    });
    if (attrs.style && productType) add(`${attrs.style} ${productType}`);
    if (attrs.pattern && productType) add(`${attrs.pattern} ${productType}`);
    if (attrs.brand_or_logo && productType) add(`${attrs.brand_or_logo} ${productType}`);

    add(searchPhrase);

    const baseWords = normalizeTerm(primaryKeyword || objectLabel || searchPhrase)
        .split(" ")
        .filter((word) => word.length > 2 && !IMAGE_SEARCH_STOP_WORDS.has(word));

    if (baseWords.length >= 2) {
        add(baseWords.slice(0, 2).join(" "));
        if (baseWords.length >= 3) add(baseWords.slice(0, 3).join(" "));
    } else if (baseWords.length === 1) {
        add(baseWords[0]);
    }

    return needles.sort((a, b) => a.length - b.length).slice(0, 12);
};

const rankImageSearchNeedles = (needles = []) => {
    const unique = [...new Set(
        (needles || []).map((needle) => distillCatalogTerm(needle)).filter((needle) => needle.length >= 3)
    )];

    return unique
        .filter((needle) => {
            const words = needle.split(" ").filter(Boolean);
            if (words.length === 1 && GENERIC_NEEDLE_TERMS.has(words[0])) return false;
            return true;
        })
        .map((needle) => {
            const words = needle.split(" ").filter(Boolean);
            let score = words.length * 25 + Math.min(needle.length, 40);
            if (words.some((word) => !GENERIC_NEEDLE_TERMS.has(word) && word.length > 3)) score += 10;
            return { needle, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((row) => row.needle);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isMongoTimeoutError = (error) => {
    const name = String(error?.name || "");
    const msg = String(error?.message || error || "").toLowerCase();
    return name === "MongoNetworkTimeoutError" || msg.includes("timed out");
};

const queryMongoByCatalogNeedle = async (needle, { limit = 32, category, useDedicated = true } = {}) => {
    const term = escapeRegex(distillCatalogTerm(needle));
    if (!term || term.length < 3) return [];

    const regex = { $regex: term, $options: "i" };
    const query = {
        status: "active",
        $or: [
            { name: regex },
            { short_description: regex },
            { sku: regex },
        ],
        ...buildMongoCategoryFilter(category),
    };

    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
    const projection = listProjection;
    const sort = { sold_count: -1, average_rating: -1, rating_count: -1, _id: -1 };

    if (useDedicated) {
        try {
            const { getImageSearchProductModel } = require("../../../config/db/imageSearchConnection");
            const DedicatedProduct = await getImageSearchProductModel();
            if (DedicatedProduct) {
                return DedicatedProduct.find(query).select(projection).sort(sort).limit(cap).lean();
            }
        } catch (error) {
            console.warn("[catalog-image] dedicated mongo failed, using default pool:", error?.message || error);
        }
    }

    return Product.find(query).select(projection).sort(sort).limit(cap).lean();
};

/** Catalog lookup — best product needle only, retry on connection timeout. */
const searchCatalogByNameNeedles = async ({ needles = [], limit = 32, category } = {}) => {
    const terms = rankImageSearchNeedles(needles).slice(0, 2);
    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
    if (!terms.length) return { items: [], total: 0 };

    const attempts = Math.min(Math.max(Number(process.env.IMAGE_SEARCH_CATALOG_RETRIES || 2), 1), 4);

    for (const term of terms) {
        for (let tryNum = 1; tryNum <= attempts; tryNum += 1) {
            const started = Date.now();
            try {
                const rows = await queryMongoByCatalogNeedle(term, { limit: cap, category, useDedicated: true });
                console.log(`[catalog-image] needle="${term}" -> ${rows.length} (${Date.now() - started}ms, try ${tryNum})`);
                if (rows.length) {
                    const items = rows.slice(0, cap).map(sanitizeSearchItem);
                    return { items, total: items.length, engine: "mongo_fallback" };
                }
                break;
            } catch (error) {
                console.warn(`[catalog-image] needle="${term}" failed (try ${tryNum}):`, error?.message || error);
                if (!isMongoTimeoutError(error) || tryNum >= attempts) break;
                await sleep(1500 * tryNum);
            }
        }
    }

    return { items: [], total: 0, engine: "mongo_fallback" };
};

/**
 * Image search catalog lookup via Elasticsearch — fast local index, same as text search.
 */
const searchCatalogByElasticsearchNeedles = async ({
    needles = [],
    limit = 32,
    skip = 0,
    category,
    fieldName,
    fieldValue,
    maxNeedles = IMAGE_SEARCH_ES_MAX_NEEDLES,
} = {}) => {
    if (!IMAGE_SEARCH_USE_ES || !(await getElasticsearchAvailability())) {
        return { items: [], total: 0, engine: "none" };
    }

    const ranked = rankImageSearchNeedles(needles).slice(0, maxNeedles);
    if (!ranked.length) return { items: [], total: 0, engine: "none" };

    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
    const merged = [];
    const seen = new Set();
    let total = 0;
    const terms = { primary: ranked[0], exactPhrase: ranked[0] };

    for (const needle of ranked) {
        if (merged.length >= cap) break;
        const started = Date.now();
        try {
            const payload = unwrapEsSearchResult(
                await esProductService.list({
                    search: needle,
                    limit: cap,
                    skip: normalizeSearchSkip(skip),
                    category,
                    fieldName,
                    fieldValue,
                    orderBy: "relevance",
                    order: -1,
                })
            );
            total = Math.max(total, payload.total);
            payload.items.forEach((item) => {
                const key = itemKey(item);
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(sanitizeSearchItem(item));
            });
            console.log(
                `[catalog-image-es] needle="${needle}" -> ${payload.items.length} (${Date.now() - started}ms)`
            );
        } catch (error) {
            console.warn(`[catalog-image-es] needle="${needle}" failed:`, error?.message || error);
        }
    }

    const items = rankSearchResults(merged, terms, ranked).slice(0, cap);
    return {
        items,
        total: Math.max(total, items.length),
        engine: items.length ? "elasticsearch" : "none",
    };
};

const queryMongoByNameNeedle = async (needle, { limit = 32, category } = {}) => {
    const term = escapeRegex(normalizeTerm(needle));
    if (!term) return [];

    const query = {
        status: "active",
        name: { $regex: term, $options: "i" },
        ...buildMongoCategoryFilter(category),
    };

    return withMongoMaxTime(Product.find(query)
        .select(listProjection)
        .sort({ average_rating: -1, rating_count: -1, sold_count: -1, _id: -1 })
        .limit(limit))
        .lean();
};

const queryMongoByText = async (needle, { limit = 32, category } = {}) => {
    const q = normalizeTerm(needle);
    if (!q) return [];

    const filter = {
        status: "active",
        $text: { $search: q },
        ...buildMongoCategoryFilter(category),
    };

    try {
        return await withMongoMaxTime(Product.find(filter, { score: { $meta: "textScore" } })
            .select(listProjection)
            .sort({ score: { $meta: "textScore" } })
            .limit(limit))
            .lean();
    } catch {
        return [];
    }
};

const variantMatchesHaystack = (haystack = "", variant = "") => {
    const needle = normalizeTerm(variant);
    if (!needle || !haystack) return false;
    if (needle.includes(" ")) {
        const tokens = needle.split(" ").filter((token) => token.length > 1);
        return tokens.length > 0 && tokens.every((token) => variantMatchesHaystack(haystack, token));
    }
    if (needle.length <= 4) {
        return new RegExp(`\\b${escapeRegex(needle)}\\b`, "i").test(haystack);
    }
    return haystack.includes(needle);
};

const matchesAnyVariant = (item, variants = []) => {
    const haystack = normalizeTerm(
        [item?.name, item?.short_description, item?.sku, item?.slug].filter(Boolean).join(" ")
    );
    if (!haystack) return false;
    return variants.some((variant) => variant && variantMatchesHaystack(haystack, variant));
};

const safeQuery = async (promise) => {
    try {
        return await promise;
    } catch (error) {
        console.warn("Catalog query failed:", error?.message || error);
        return [];
    }
};

const loadCatalogBatch = async (category, { sort, batchLimit } = {}) => {
    const catalogQuery = {
        status: "active",
        ...buildMongoCategoryFilter(category),
    };
    return safeQuery(
        Product.find(catalogQuery)
            .select(listProjection)
            .sort(sort)
            .limit(batchLimit)
            .lean()
    );
};

const loadRecentCatalogBatch = async (category, batchLimit = CATALOG_BATCH_LIMIT) =>
    loadCatalogBatch(category, {
        sort: { date_created_utc: -1, _id: -1 },
        batchLimit,
    });

const buildTextSearchNeedles = (raw, terms, variants = []) => {
    const needles = [];
    const seen = new Set();
    const add = (value) => {
        const term = normalizeTerm(value);
        if (!term || term.length < 3 || seen.has(term)) return;
        seen.add(term);
        needles.push(term);
    };

    add(terms.primary);
    if (Array.isArray(terms.keywords)) terms.keywords.slice(0, 3).forEach(add);
    variants.slice(0, 3).forEach(add);

    return needles
        .filter((term) => !term.includes(" ") && term.length >= 8)
        .slice(0, 2);
};

const searchMongoCatalog = async (raw, terms, { limit = 32, category } = {}) => {
    const variants = buildSearchVariants(raw, terms);
    const textNeedles = buildTextSearchNeedles(raw, terms, variants);
    const remoteQueries = [
        ...textNeedles.map((needle) =>
            safeQuery(queryMongoByText(needle, { limit, category }))
        ),
        ...(REMOTE_MONGO_SEARCH
            ? variants.slice(0, 2).map((variant) =>
                  safeQuery(queryMongoByNameNeedle(variant, { limit, category }))
              )
            : []),
    ];

    const [catalogBatch, ...remoteBatches] = await Promise.all([
        loadRecentCatalogBatch(category),
        ...remoteQueries,
    ]);

    const merged = [];
    const seen = new Set();
    const ingest = (items = []) => {
        items.forEach((item) => {
            const key = itemKey(item);
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        });
    };

    ingest(rankSearchResults(catalogBatch.filter((item) => matchesAnyVariant(item, variants)), terms, variants));
    remoteBatches.forEach((items) => ingest(items));

    return rankSearchResults(merged, terms, variants).slice(0, limit);
};

const searchAlibabaFallback = async ({ terms, variants, limit, skip }) => {
    const primaryKeyword = terms.primary || terms.correctedQuery || terms.original || "";
    if (!primaryKeyword) return [];

    const { searchAlibabaCatalogByKeywords } = require("../helper/imageSearchPipeline");
    return safeQuery(
        searchAlibabaCatalogByKeywords({
            primaryKeyword,
            keywords: variants,
            pageLimit: limit,
            pageSkip: Math.max(1, Number(skip) || 1),
        })
    );
};

const unwrapEsSearchResult = (result) => {
    if (Array.isArray(result)) return { items: result, total: 0 };
    return {
        items: result?.items || [],
        total: typeof result?.total === "number" ? result.total : 0,
    };
};

const normalizeSearchSkip = (skip) => Math.max(0, Number(skip) || 0);

const buildSearchMeta = (raw, terms, needle, engine, extra = {}) => ({
    engine,
    aiExpanded: Boolean(terms.aiExpanded),
    originalQuery: raw,
    correctedQuery: terms.correctedQuery || raw,
    searchQuery: needle,
    primary: terms.primary,
    keywords: terms.keywords,
    productType: terms.productType || "",
    categoryHint: terms.categoryHint || "",
    userIntent: terms.userIntent || "",
    exactPhrase: terms.exactPhrase || terms.primary || "",
    didCorrect: Boolean(
        terms.correctedQuery
        && normalizeTerm(terms.correctedQuery) !== normalizeTerm(raw)
    ),
    visualIntent: Boolean(terms.visualIntent),
    ...extra,
});

const searchElasticsearchCatalog = async ({
    raw,
    terms,
    variants,
    limit,
    skip,
    category,
    fieldName,
    fieldValue,
    singleCategoryOnly,
    maxVariants = 4,
}) => {
    const baseQuery = {
        category,
        fieldName,
        fieldValue,
        limit,
        skip: normalizeSearchSkip(skip),
        singleCategoryOnly,
        orderBy: "relevance",
        order: -1,
    };

    const merged = [];
    const seen = new Set();
    let primaryPayload = { items: [], total: 0 };

    for (const variant of variants.slice(0, maxVariants)) {
        if (merged.length >= limit) break;
        const payload = unwrapEsSearchResult(
            await esProductService.list({ ...baseQuery, search: variant })
        );
        if (!primaryPayload.items.length) primaryPayload = payload;
        payload.items.forEach((item) => {
            const key = itemKey(item);
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        });
    }

    return {
        items: rankSearchResults(merged, terms, variants).slice(0, limit),
        total: Math.max(primaryPayload.total, merged.length),
        engine: "elasticsearch",
    };
};

const searchCatalogByText = async ({
    search = "",
    limit = 32,
    skip = 1,
    category,
    fieldName,
    fieldValue,
    singleCategoryOnly = false,
    fast = false,
    skipExternal = false,
    intentContext = null,
    req = null,
} = {}) => {
    const raw = String(search || "").trim();
    if (!raw) {
        return { items: [], total: 0, searchMeta: { engine: "none" } };
    }

    let context = intentContext;
    if (!context && !fast) {
        try {
            const { getSearchIntentContext } = require("../../ai/services/searchIntentService");
            context = await getSearchIntentContext(raw, req);
        } catch (_) {
            context = {};
        }
    }

    const terms = await expandSearchQuery(raw, context || {}, { fast });
    const variants = buildSearchVariants(raw, terms);
    const needle = terms.primary || terms.correctedQuery || raw;
    const esSkip = normalizeSearchSkip(skip);

    if (fast && await getElasticsearchAvailability()) {
        try {
            const payload = unwrapEsSearchResult(
                await esProductService.list({
                    search: terms.primary || raw,
                    limit: Math.max(limit, 24),
                    skip: esSkip,
                    category,
                    fieldName,
                    fieldValue,
                    singleCategoryOnly,
                    orderBy: "relevance",
                    order: -1,
                })
            );
            // Fast path: family filter only (no embedding round-trip) for autocomplete speed.
            const intelligent = await applyIntelligentSearchLayer({
                items: rankSearchResults(payload.items, terms, variants),
                terms,
                raw,
                limit,
                category,
                fast: true,
            });
            const items = intelligent.items.map(sanitizeSearchItem);
            return {
                items,
                total: Math.max(payload.total, items.length),
                searchMeta: buildSearchMeta(raw, terms, needle, "elasticsearch", {
                    intelligent: intelligent.meta,
                }),
            };
        } catch (error) {
            console.warn("Fast Elasticsearch search failed:", error?.message || error);
            return {
                items: [],
                total: 0,
                searchMeta: buildSearchMeta(raw, terms, needle, "elasticsearch"),
            };
        }
    }

    let merged = [];
    let total = 0;
    let engine = "mongo_fallback";

    if (await getElasticsearchAvailability()) {
        try {
            const esResult = await searchElasticsearchCatalog({
                raw,
                terms,
                variants,
                limit: Math.max(limit, 40),
                skip: esSkip,
                category,
                fieldName,
                fieldValue,
                singleCategoryOnly,
            });
            merged = esResult.items;
            total = esResult.total;
            engine = esResult.engine;
        } catch (error) {
            console.warn("Elasticsearch text search failed:", error?.message || error);
            merged = [];
        }
    }

    const needsMongoFallback = merged.length === 0;
    if (needsMongoFallback) {
        const mongoItems = await withTimeout(
            searchMongoCatalog(raw, terms, { limit, category }),
            MONGO_SEARCH_TIMEOUT_MS,
            []
        );
        const seen = new Set(merged.map(itemKey));
        mongoItems.forEach((item) => {
            const key = itemKey(item);
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        });
        if (mongoItems.length && engine !== "elasticsearch") engine = "mongo_fallback";
        else if (mongoItems.length && engine === "elasticsearch") engine = "elasticsearch+mongo";
    }

    if (!skipExternal && !fast && SEARCH_INCLUDE_1688 && merged.length < 3) {
        const alibabaItems = await searchAlibabaFallback({ terms, variants, limit, skip });
        if (alibabaItems.length) {
            const seen = new Set(merged.map(itemKey));
            alibabaItems.forEach((item) => {
                const key = itemKey(item);
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            });
            engine = engine === "elasticsearch" ? "elasticsearch+alibaba" : `${engine}+alibaba`;
        }
    }

    const ranked = rankSearchResults(merged, terms, variants);
    const intelligent = await applyIntelligentSearchLayer({
        items: ranked,
        terms,
        raw,
        limit,
        category,
        fast: false,
    });

    const items = intelligent.items.map(sanitizeSearchItem);
    if (intelligent.meta?.semanticFilled) {
        engine = `${engine}+semantic`;
    }

    try {
        const { recordSearchIntent } = require("../../ai/services/searchIntentService");
        void recordSearchIntent(raw, terms, req);
    } catch (_) {
        /* ignore tracking errors */
    }

    return {
        items,
        total: Math.max(total, items.length),
        searchMeta: buildSearchMeta(raw, terms, needle, engine, {
            intelligent: intelligent.meta,
        }),
    };
};

/**
 * Image search catalog lookup — Elasticsearch first (local index), Mongo regex fallback.
 */
const searchCatalogForImage = async ({
    search = "",
    limit = 32,
    skip = 0,
    category,
    vision,
    fieldName,
    fieldValue,
} = {}) => {
    const { expandNeedlesForImageSearch } = require("./catalogVocabularyService");

    let needles = buildImageSearchCatalogNeedles({
        primaryKeyword: vision?.primaryKeyword || search,
        searchPhrase: vision?.searchPhrase || search,
        objectLabel: vision?.objectLabel || "",
        keywords: vision?.keywords || [],
        categoryHint: vision?.attributes?.category || "",
        attributes: vision?.attributes || {},
    });

    needles = await expandNeedlesForImageSearch({
        needles,
        primaryKeyword: vision?.primaryKeyword || search,
        searchPhrase: vision?.searchPhrase || search,
        objectLabel: vision?.objectLabel || "",
        keywords: vision?.keywords || [],
        categoryHint: vision?.attributes?.category || "",
    });

    if (!needles.length) {
        const raw = String(search || "").trim();
        if (!raw) return { items: [], total: 0, engine: "none" };
        needles.push(raw);
    }

    const esResult = await searchCatalogByElasticsearchNeedles({
        needles,
        limit,
        skip,
        category,
        fieldName,
        fieldValue,
    });
    if (esResult.items.length) {
        return esResult;
    }

    const mongoResult = await searchCatalogByNameNeedles({ needles, limit, category });
    return {
        items: mongoResult.items || [],
        total: mongoResult.total || 0,
        engine: mongoResult.items?.length ? "mongo_fallback" : "none",
    };
};

module.exports = {
    searchCatalogByText,
    searchCatalogForImage,
    searchCatalogByNameNeedles,
    buildImageSearchCatalogNeedles,
    rankImageSearchNeedles,
    buildSearchVariants,
    rankSearchResults,
    sanitizeSearchItem,
};
