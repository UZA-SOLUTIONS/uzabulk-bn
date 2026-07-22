const { getSimilarProducts } = require("./similarProductsService");

const getSearchCatalogForImage = () =>
    require("./catalogSearchService").searchCatalogForImage;

const STOP_WORDS = new Set([
    "the", "and", "with", "for", "from", "product", "products", "item", "items",
    "wholesale", "bulk", "new", "hot", "best", "quality", "high", "factory", "style",
]);

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (value = "") =>
    normalizeTerm(value).split(" ").filter((word) => word.length > 2);

const isStrictImageSearchRelevance = () =>
    String(process.env.IMAGE_SEARCH_STRICT_RELEVANCE ?? "true").toLowerCase() !== "false";

const minRelevanceScore = () =>
    Math.max(Number(process.env.IMAGE_SEARCH_MIN_RELEVANCE_SCORE || 14), 0);

const maxNonVisualSupplementCount = (pageLimit = 24) => Math.min(
    // Stricter default when visual seeds exist — reduces junk fillers after a good match.
    Math.max(Number(process.env.IMAGE_SEARCH_MAX_SUPPLEMENT_ITEMS || 4), 0),
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

    return {
        seeds,
        topSeed,
        seedCategoryIds,
        seedTokens,
        topSeedCategoryIds,
        topSeedTokens,
        vision,
    };
};

const scoreItemRelevance = (item, context = {}) => {
    if (!item || typeof item !== "object") return 0;
    if (isVisualMatchItem(item)) return 100;

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

    let score = tokenOverlap * 10;

    const topSeedCategoryIds = context.topSeedCategoryIds || new Set();
    const seedCategoryIds = context.seedCategoryIds || new Set();
    const sharesTopCategory = topSeedCategoryIds.size
        && [...topSeedCategoryIds].some((id) => itemCategoryIds.has(id));
    const sharesSeedCategory = seedCategoryIds.size
        && [...seedCategoryIds].some((id) => itemCategoryIds.has(id));

    if (sharesTopCategory) score += 18;
    else if (sharesSeedCategory) score += 8;

    const primary = normalizeTerm(context.topSeed?.name || context.vision?.searchPhrase || "");
    if (primary && name.includes(primary.slice(0, Math.min(primary.length, 24)))) {
        score += 12;
    }

    if (!context.seeds?.length && context.vision) {
        let kwOverlap = 0;
        (context.seedTokens || new Set()).forEach((token) => {
            if (token.length < 3) return;
            if (itemTokens.includes(token)) kwOverlap += 1;
            else if (name.includes(token)) kwOverlap += 0.5;
        });
        return kwOverlap >= 1.5 ? Number((kwOverlap * 10).toFixed(4)) : 0;
    }

    if (!sharesTopCategory && !sharesSeedCategory && tokenOverlap < 1.5) {
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

    return sorted.filter((item, index) => {
        if (!item || typeof item !== "object") return false;
        if (index === 0) return true;
        const sim = Number(item.similarity_score || 0);
        if (!topCats.size) return topSim - sim <= 0.15;
        const itemCats = new Set(collectCategoryIds(item));
        const sameCategory = [...topCats].some((id) => itemCats.has(id));
        if (!sameCategory) return false;
        return topSim - sim <= 0.15;
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
    const prunedVisual = pruneOutlierVisualMatches(visual, context);
    supplemental.sort((a, b) => b.relevance - a.relevance);

    const maxSupplement = context.seeds?.length
        ? maxNonVisualSupplementCount(pageLimit)
        : pageLimit;

    return [...prunedVisual, ...supplemental.slice(0, maxSupplement).map((row) => row.item)].slice(0, pageLimit);
};

const filterSupplementalItems = (items = [], context = {}) => {
    if (!isStrictImageSearchRelevance()) return items;
    return (items || []).filter((item) => scoreItemRelevance(item, context) >= minRelevanceScore());
};

const minVisualSimilarity = () => Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_MIN_SIMILARITY || 0.38), 0),
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
                const rows = await getSimilarProducts(topSeed._id, { limit: 4 });
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
                limit: Math.min(pageLimit, 12),
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
    const isVisual = mode === "visual" || mode === "visual+keyword" || vision.provider === "visual-match";

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
