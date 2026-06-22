const Product = require("../../../models/productsTable");
const esProductService = require("./esProductService");
const { expandSearchQuery, basicQueryCleanup, normalizeTerm } = require("../../ai/services/aiTextSearchService");
const { getElasticsearchAvailability } = require("../../../elasticsearch/availability");

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
const ALIBABA_SEARCH_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.SEARCH_ALIBABA_TIMEOUT_MS || 6000), 3000),
    12000
);
const REMOTE_MONGO_SEARCH = String(process.env.SEARCH_REMOTE_MONGO || "0") === "1";

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
    return { categories: category };
};

const queryMongoByNameNeedle = async (needle, { limit = 32, category } = {}) => {
    const term = escapeRegex(normalizeTerm(needle));
    if (!term) return [];

    const query = {
        status: "active",
        name: { $regex: term, $options: "i" },
        ...buildMongoCategoryFilter(category),
    };

    return Product.find(query)
        .select(listProjection)
        .sort({ average_rating: -1, rating_count: -1, sold_count: -1, _id: -1 })
        .limit(limit)
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
        return await Product.find(filter, { score: { $meta: "textScore" } })
            .select(listProjection)
            .sort({ score: { $meta: "textScore" } })
            .limit(limit)
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
}) => {
    const baseQuery = {
        category,
        fieldName,
        fieldValue,
        limit,
        skip,
        singleCategoryOnly,
        orderBy: "relevance",
        order: -1,
    };

    const merged = [];
    const seen = new Set();
    let primaryPayload = { items: [], total: 0 };

    for (const variant of variants.slice(0, 4)) {
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
} = {}) => {
    const raw = String(search || "").trim();
    if (!raw) {
        return { items: [], total: 0, searchMeta: { engine: "none" } };
    }

    const terms = await expandSearchQuery(raw, {}, { fast });
    const variants = buildSearchVariants(raw, terms);
    const needle = terms.primary || terms.correctedQuery || raw;

    let merged = [];
    let total = 0;
    let engine = "mongo_fallback";

    if (await getElasticsearchAvailability()) {
        try {
            const esResult = await searchElasticsearchCatalog({
                raw,
                terms,
                variants,
                limit,
                skip: Math.max(1, Number(skip) || 1),
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

    if (merged.length < limit) {
        const mongoItems = await searchMongoCatalog(raw, terms, { limit, category });
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

    if (!skipExternal && merged.length < 3) {
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

    const items = rankSearchResults(merged, terms, variants)
        .slice(0, limit)
        .map(sanitizeSearchItem);

    return {
        items,
        total: Math.max(total, items.length),
        searchMeta: {
            engine,
            aiExpanded: Boolean(terms.aiExpanded),
            originalQuery: raw,
            correctedQuery: raw,
            searchQuery: needle,
            primary: terms.primary,
            keywords: terms.keywords,
            productType: terms.productType || "",
            categoryHint: terms.categoryHint || "",
            userIntent: "",
            exactPhrase: terms.exactPhrase || terms.primary || "",
            didCorrect: false,
        },
    };
};

/**
 * Lightweight catalog lookup for image search — skips ES and large batch scans.
 */
const searchCatalogForImage = async ({ search = "", limit = 32, category } = {}) => {
    const raw = String(search || "").trim();
    if (!raw) return { items: [], total: 0 };

    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
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

    const needles = [];
    const needleSeen = new Set();
    const addNeedle = (value) => {
        const term = normalizeTerm(value);
        if (!term || term.length < 2 || needleSeen.has(term)) return;
        needleSeen.add(term);
        needles.push(term);
    };
    const words = raw.toLowerCase().split(/\s+/).filter((token) => token.length >= 2);
    if (words.length >= 2) addNeedle(words.slice(-2).join(" "));
    addNeedle(raw);

    for (const needle of needles.slice(0, 2)) {
        if (merged.length >= cap) break;

        try {
            ingest(await queryMongoByText(needle, { limit: cap, category }));
        } catch (error) {
            console.warn("Image catalog text query failed:", error?.message || error);
        }

        if (merged.length < 3) {
            try {
                ingest(await queryMongoByNameNeedle(needle, { limit: cap, category }));
            } catch (error) {
                console.warn("Image catalog name query failed:", error?.message || error);
            }
        }
    }

    if (merged.length < 3) {
        const terms = basicQueryCleanup(raw);
        const variants = buildSearchVariants(raw, terms);
        try {
            const batch = await Product.find({
                status: "active",
                ...buildMongoCategoryFilter(category),
            })
                .select(listProjection)
                .sort({ date_created_utc: -1, _id: -1 })
                .limit(IMAGE_SEARCH_BATCH_LIMIT)
                .lean();
            ingest(
                rankSearchResults(
                    batch.filter((item) => matchesAnyVariant(item, variants)),
                    terms,
                    variants
                )
            );
        } catch (error) {
            console.warn("Image catalog batch query failed:", error?.message || error);
        }
    }

    const items = merged.slice(0, cap).map(sanitizeSearchItem);
    if (items.length) {
        await Product.populate(items, { path: "featured_image", select: "link -_id" });
    }
    return { items, total: items.length };
};

module.exports = {
    searchCatalogByText,
    searchCatalogForImage,
    buildSearchVariants,
    rankSearchResults,
    sanitizeSearchItem,
};
