const { getSimilarProducts } = require("./similarProductsService");

const getSearchCatalogForImage = () =>
    require("./catalogSearchService").searchCatalogForImage;

const STOP_WORDS = new Set([
    "the", "and", "with", "for", "from", "product", "products", "item", "items",
    "wholesale", "bulk", "new", "hot", "best", "quality", "high", "factory", "style",
    "set", "pack", "pcs", "piece", "pieces", "lot",
]);
const TYPE_DESCRIPTOR_TOKENS = new Set([
    "men", "mens", "man", "women", "womens", "woman",
    "black", "white", "brown", "blue", "red", "green", "yellow", "pink", "purple",
    "gold", "silver", "gray", "grey", "solid", "design", "pattern", "material",
    "leather", "casual", "formal",
]);
const FOOTWEAR_TOKENS = new Set([
    "shoe", "shoes", "loafer", "loafers", "oxford", "oxfords", "brogue", "brogues",
    "wingtip", "heels", "heel", "boot", "boots", "sneaker", "sneakers",
    "slipper", "slippers", "sandal", "sandals", "footwear",
]);

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (value = "") =>
    normalizeTerm(value).split(" ").filter((word) => word.length > 2);

const isStrictImageSearchRelevance = () =>
    String(process.env.IMAGE_SEARCH_STRICT_RELEVANCE ?? "true").toLowerCase() !== "false";

const minRelevanceScore = () =>
    Math.max(Number(process.env.IMAGE_SEARCH_MIN_RELEVANCE_SCORE || 12), 0);

const maxNonVisualSupplementCount = (pageLimit = 24) => Math.min(
    // When we have visual seeds, keep fillers low. When keyword-only, allow more.
    Math.max(Number(process.env.IMAGE_SEARCH_MAX_SUPPLEMENT_ITEMS || 8), 0),
    pageLimit
);

const isVisualExpansionEnabled = () =>
    String(process.env.IMAGE_SEARCH_VISUAL_EXPAND_CATALOG ?? "false").toLowerCase() === "true";

const isSimilarExpansionEnabled = () =>
    String(process.env.IMAGE_SEARCH_VISUAL_EXPAND_SIMILAR ?? "true").toLowerCase() !== "false";

const collectCategoryIds = (item) => {
    if (!item || typeof item !== "object") return [];
    return (item.categories || [])
        .map((row) => String(row?._id || row || "").trim())
        .filter(Boolean);
};

const coreTypeTokensFromVision = (vision = null) => {
    if (!vision) return new Set();
    const attrs = vision.attributes || {};
    const tokens = new Set();
    [
        attrs.product_type || vision.objectLabel || vision.primaryKeyword,
        attrs.category,
    ].forEach((value) => {
        tokenize(value)
            .filter((word) => !STOP_WORDS.has(word) && !TYPE_DESCRIPTOR_TOKENS.has(word) && word.length >= 3)
            .forEach((word) => tokens.add(word));
    });
    if (tokens.has("shoes")) tokens.add("shoe");
    if (tokens.has("shoe") || tokens.has("shoes")) {
        tokens.delete("dress");
    }
    return tokens;
};

const buildRelevanceContext = (vision = null, visualSeeds = []) => {
    const seeds = (visualSeeds || []).filter(isVisualMatchItem);
    const topSeed = seeds[0] || null;
    const seedCategoryIds = new Set();
    const seedTokens = new Set();

    const addTokens = (text = "", minLen = 3) => {
        tokenize(text)
            .filter((word) => !STOP_WORDS.has(word) && word.length >= minLen)
            .forEach((word) => seedTokens.add(word));
    };

    seeds.forEach((seed) => {
        collectCategoryIds(seed).forEach((id) => seedCategoryIds.add(id));
        addTokens(seed?.name, 3);
        addTokens(seed?.short_description, 4);
    });

    if (vision) {
        const attrs = vision.attributes || {};
        addTokens(vision.searchPhrase, 3);
        addTokens(vision.objectLabel, 3);
        addTokens(vision.topVisualMatchName, 3);
        addTokens(vision.featureSummary, 3);
        (vision.keywords || []).forEach((kw) => addTokens(kw, 3));
        addTokens(attrs.product_type, 3);
        addTokens(attrs.category, 3);
        addTokens(attrs.brand_or_logo, 3);
        addTokens(attrs.style, 3);
        addTokens(attrs.pattern, 3);
        addTokens(attrs.shape, 3);
        addTokens(attrs.visible_text, 3);
        addTokens(attrs.use_case, 3);
        (attrs.colors || []).forEach((kw) => addTokens(kw, 3));
        (attrs.materials || []).forEach((kw) => addTokens(kw, 3));
        (attrs.distinctive_features || []).forEach((kw) => addTokens(kw, 3));
        (attrs.parts_and_components || []).forEach((kw) => addTokens(kw, 3));
    }

    const topSeedCategoryIds = new Set(collectCategoryIds(topSeed));
    const topSeedTokens = new Set(
        tokenize(topSeed?.name || "")
            .filter((word) => !STOP_WORDS.has(word) && word.length >= 3)
    );
    const mustHaveTypeTokens = coreTypeTokensFromVision(vision);

    return {
        seeds,
        topSeed,
        seedCategoryIds,
        seedTokens,
        topSeedCategoryIds,
        topSeedTokens,
        mustHaveTypeTokens,
        vision,
    };
};

const hasRequiredTypeOverlap = (item, context = {}) => {
    const required = context.mustHaveTypeTokens;
    if (!required || !required.size) return true;

    const name = normalizeTerm(item?.name || "");
    const desc = normalizeTerm(item?.short_description || "");
    const itemTokens = new Set(
        tokenize(`${name} ${desc}`).filter((word) => !STOP_WORDS.has(word))
    );

    let hits = 0;
    required.forEach((token) => {
        if (itemTokens.has(token) || name.includes(token)) hits += 1;
    });

    const requiresFootwear = [...required].some((token) => FOOTWEAR_TOKENS.has(token));
    if (requiresFootwear) {
        const hasFootwearHit = [...FOOTWEAR_TOKENS].some((token) => itemTokens.has(token) || name.includes(token));
        if (!hasFootwearHit) return false;
    }

    // At least one core type token must appear (e.g. "cylinder", "propane", "boot").
    return hits >= 1;
};

const scoreItemRelevance = (item, context = {}) => {
    if (!item || typeof item !== "object") return 0;
    if (isVisualMatchItem(item)) return 100;
    if (!hasRequiredTypeOverlap(item, context)) return 0;

    const name = normalizeTerm(item?.name || "");
    const desc = normalizeTerm(item?.short_description || "");
    if (!name) return 0;

    const itemTokens = tokenize(`${name} ${desc}`).filter((word) => !STOP_WORDS.has(word));
    const itemCategoryIds = new Set(collectCategoryIds(item));

    let tokenOverlap = 0;
    (context.topSeedTokens || new Set()).forEach((token) => {
        if (itemTokens.includes(token)) tokenOverlap += 1;
        else if (name.includes(token)) tokenOverlap += 0.5;
    });

    if (tokenOverlap < 1) {
        (context.seedTokens || new Set()).forEach((token) => {
            if (token.length < 4) return;
            if (itemTokens.includes(token)) tokenOverlap += 0.35;
            else if (name.includes(token)) tokenOverlap += 0.2;
        });
    }

    // Extra weight for product-type / object-label hits.
    let typeHits = 0;
    (context.mustHaveTypeTokens || new Set()).forEach((token) => {
        if (itemTokens.includes(token)) typeHits += 1;
        else if (name.includes(token)) typeHits += 0.6;
    });
    tokenOverlap += typeHits * 0.75;

    let score = tokenOverlap * 12;

    const topSeedCategoryIds = context.topSeedCategoryIds || new Set();
    const seedCategoryIds = context.seedCategoryIds || new Set();
    const sharesTopCategory = topSeedCategoryIds.size
        && [...topSeedCategoryIds].some((id) => itemCategoryIds.has(id));
    const sharesSeedCategory = seedCategoryIds.size
        && [...seedCategoryIds].some((id) => itemCategoryIds.has(id));

    if (sharesTopCategory) score += 22;
    else if (sharesSeedCategory) score += 10;

    const primary = normalizeTerm(context.topSeed?.name || context.vision?.searchPhrase || "");
    if (primary && name.includes(primary.slice(0, Math.min(primary.length, 24)))) {
        score += 14;
    }

    if (!context.seeds?.length && context.vision) {
        let kwOverlap = 0;
        (context.seedTokens || new Set()).forEach((token) => {
            if (token.length < 3) return;
            if (itemTokens.includes(token)) kwOverlap += 1;
            else if (name.includes(token)) kwOverlap += 0.5;
        });
        // Require some keyword overlap when there is no visual seed, but be lenient
        // so image-only searches still surface keyword results.
        if (kwOverlap < 1 && typeHits < 1) return 0;
        return Number((kwOverlap * 12 + typeHits * 8).toFixed(4));
    }

    if (!sharesTopCategory && !sharesSeedCategory && tokenOverlap < 2) {
        return 0;
    }

    return Number(score.toFixed(4));
};

const pruneOutlierVisualMatches = (visual = [], context = {}) => {
    if (visual.length <= 1 || !isStrictImageSearchRelevance()) return visual;

    const sorted = [...visual].sort(
        (a, b) => Number(b.similarity_score || 0) - Number(a.similarity_score || 0)
    );
    const top = sorted[0];
    const topSim = Number(top.similarity_score || 0);
    const topCats = context.topSeedCategoryIds || new Set();
    const maxGap = Math.max(Number(process.env.IMAGE_SEARCH_VISUAL_MAX_GAP || 0.08), 0.03);

    return sorted.filter((item, index) => {
        if (!item || typeof item !== "object") return false;
        if (index === 0) return true;
        const sim = Number(item.similarity_score || 0);
        if (topSim - sim > maxGap) return false;

        if (topCats.size) {
            const itemCats = new Set(collectCategoryIds(item));
            const sameCategory = [...topCats].some((id) => itemCats.has(id));
            if (!sameCategory) return false;
        }

        // Drop visual "matches" that disagree with VL product type.
        if (!hasRequiredTypeOverlap(item, context) && (context.mustHaveTypeTokens?.size || 0) >= 2) {
            return false;
        }
        return true;
    });
};

const filterImageSearchResults = (items = [], context = {}, { pageLimit = 24 } = {}) => {
    if (!Array.isArray(items) || !items.length) return [];
    if (!isStrictImageSearchRelevance()) return items.slice(0, pageLimit);

    const minScore = minRelevanceScore();
    const visual = [];
    const supplemental = [];

    items.forEach((item) => {
        if (!item || typeof item !== "object") return;
        if (isVisualMatchItem(item)) {
            visual.push(item);
            return;
        }
        const relevance = scoreItemRelevance(item, context);
        if (relevance >= minScore) {
            supplemental.push({ item, relevance });
        }
    });

    visual.sort((a, b) => Number(b.similarity_score || 0) - Number(a.similarity_score || 0));
    const prunedVisual = pruneOutlierVisualMatches(visual, {
        ...context,
        topSeedCategoryIds: context.topSeedCategoryIds?.size
            ? context.topSeedCategoryIds
            : new Set(collectCategoryIds(visual[0])),
        topSeedTokens: context.topSeedTokens?.size
            ? context.topSeedTokens
            : new Set(tokenize(visual[0]?.name || "").filter((w) => !STOP_WORDS.has(w))),
    });
    supplemental.sort((a, b) => b.relevance - a.relevance);

    const maxSupplement = context.seeds?.length
        ? Math.min(maxNonVisualSupplementCount(pageLimit), 6)
        : pageLimit;

    return [...prunedVisual, ...supplemental.slice(0, maxSupplement).map((row) => row.item)].slice(0, pageLimit);
};

const filterSupplementalItems = (items = [], context = {}) => {
    if (!isStrictImageSearchRelevance()) return items;
    return (items || []).filter((item) => scoreItemRelevance(item, context) >= minRelevanceScore());
};

const minVisualSimilarity = () => Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_MIN_SIMILARITY || 0.48), 0),
    1
);

const isVisualMatchItem = (item) => {
    if (!item || typeof item !== "object") return false;
    if (item.match_type === "weak_visual" || item.match_type === "fallback") return false;
    const similarity = Number(item?.similarity_score || 0);
    // Only strong visual matches; do not promote below-threshold scores via match_type alone.
    return similarity >= minVisualSimilarity() && (
        item.match_type === "visual" || item.match_type == null || similarity > 0
    );
};

const trimCatalogLabel = (name = "", maxWords = 6) => {
    const text = String(name || "").trim();
    if (!text || text === "Product") return "";
    return text.split(/\s+/).slice(0, maxWords).join(" ");
};

const buildVisionFromVisualMatches = (visualItems = []) => {
    const seeds = (visualItems || []).filter(isVisualMatchItem);
    if (!seeds.length) return null;

    const top = seeds[0];
    const topName = String(top?.name || "").trim();
    const label = trimCatalogLabel(topName, 5);
    const names = seeds.map((row) => String(row?.name || "").trim()).filter(Boolean);

    return {
        provider: "visual-match",
        searchMode: "visual",
        objectLabel: label || topName,
        primaryKeyword: label || topName,
        searchPhrase: topName,
        keywords: names
            .flatMap((name) => name.split(/\s+/))
            .filter((word) => word.length > 2)
            .slice(0, 8),
        topVisualMatchName: topName,
        topVisualMatchScore: Number(top.similarity_score || 0),
        visualMatchCount: seeds.length,
    };
};

/**
 * Grow results from pHash/visual seeds: similar products + catalog lookup by matched product names.
 */
const expandFromVisualSeeds = async ({
    seeds = [],
    pageLimit = 24,
    skip = 1,
    category,
    fieldName,
    fieldValue,
} = {}) => {
    const visualSeeds = (seeds || []).filter(isVisualMatchItem).slice(0, 2);
    if (!visualSeeds.length) {
        return { catalogItems: [], similarItems: [], vision: null };
    }

    const vision = buildVisionFromVisualMatches(visualSeeds);
    const relevanceContext = buildRelevanceContext(vision, visualSeeds);
    const similarItems = [];
    const seenSimilar = new Set(
        visualSeeds.map((item) => String(item?._id || item?.offerId || ""))
    );

    if (isSimilarExpansionEnabled()) {
        const topSeed = visualSeeds[0];
        if (topSeed?._id) {
            try {
                const rows = await getSimilarProducts(topSeed._id, { limit: 3 });
                rows.forEach((row) => {
                    const key = String(row?._id || row?.offerId || "");
                    if (!key || seenSimilar.has(key)) return;
                    seenSimilar.add(key);
                    similarItems.push(row);
                });
            } catch (error) {
                console.warn("[visual-first-search] similar expansion failed:", error?.message || error);
            }
        }
    }

    let catalogItems = [];
    if (isVisualExpansionEnabled()) {
        try {
            const catalogResult = await getSearchCatalogForImage()({
                search: vision.searchPhrase,
                limit: Math.min(pageLimit, 8),
                skip,
                category,
                fieldName,
                fieldValue,
                vision,
            });
            catalogItems = catalogResult?.items || [];
        } catch (error) {
            console.warn("[visual-first-search] catalog expansion failed:", error?.message || error);
        }
    }

    const filteredSimilar = filterSupplementalItems(similarItems, relevanceContext);
    const filteredCatalog = filterSupplementalItems(catalogItems, relevanceContext);

    if (filteredSimilar.length < similarItems.length || filteredCatalog.length < catalogItems.length) {
        console.log(
            `[visual-first-search] filtered supplemental similar=${similarItems.length - filteredSimilar.length} catalog=${catalogItems.length - filteredCatalog.length}`
        );
    }

    return {
        catalogItems: filteredCatalog,
        similarItems: filteredSimilar,
        vision,
        relevanceContext,
    };
};

const buildImageSearchListMeta = (result = {}, extras = {}) => {
    const vision = result.vision || {};
    const mode = result.searchMode || vision.searchMode || "keyword";
    const topName = vision.topVisualMatchName || vision.objectLabel || vision.primaryKeyword || "";
    const topPct = Number(vision.topVisualMatchScore || 0) > 0
        ? Math.round(Number(vision.topVisualMatchScore) * 100)
        : null;
    const isVisual = mode === "visual"
        || mode === "visual+keyword"
        || mode === "visual-strong"
        || mode === "feature+visual"
        || vision.provider === "visual-match";

    const label = isVisual && topName
        ? topName
        : (vision.primaryKeyword || vision.objectLabel || extras.fallbackSearch || "");

    return {
        imageSearch: true,
        imageSearchProvider: result.provider || "none",
        imageSearchMode: mode,
        imageSearchLabel: label,
        imageSearchTopMatch: topName,
        imageSearchTopMatchPercent: topPct,
        imageSearchVisualMatchCount: Number(vision.visualMatchCount || 0),
        imageSearchKeyword: label,
        imageSearchObjectLabel: vision.objectLabel || label,
        imageSearchKeywords: vision.keywords || [],
        imageSearchPhrase: isVisual ? (vision.searchPhrase || topName) : (vision.searchPhrase || ""),
        ...extras,
    };
};

module.exports = {
    isVisualMatchItem,
    buildVisionFromVisualMatches,
    expandFromVisualSeeds,
    buildImageSearchListMeta,
    buildRelevanceContext,
    filterImageSearchResults,
    filterSupplementalItems,
    scoreItemRelevance,
    minVisualSimilarity,
};
