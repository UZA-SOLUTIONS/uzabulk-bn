/**
 * Smart image search: scan every visible image feature first, then match catalog products to those features.
 * Visual (pHash) photo matching runs in parallel and boosts exact image matches.
 */
const fs = require("fs");
const path = require("path");
const { isDashscopeConfigured } = require("../dashscopeClient");
const {
    extractImageSearchKeywords,
    isAiImageSearchEnabled,
    searchCatalogByEmbeddingPhrase,
} = require("./aiImageSearchService");
const {
    runAlibabaImageSearch,
    runEnhanced1688ImageSearch,
    is1688EnhancedImageSearchEnabled,
    searchAlibabaCatalogByKeywords,
    runLocalVisualSearch,
} = require("../../products/helper/imageSearchPipeline");
const { isLocalImageSearchEnabled } = require("../../products/services/localImageSearch");
const { guessLocalImagePath } = require("../helpers/resolveVisionImageInput");
const { isMongoConnected } = require("../../../config/db");
const { withPromiseTimeout } = require("../../../utils/mongoQueryOptions");
const Product = require("../../../models/productsTable");
const { rerankImageSearchItems } = require("../../products/services/catalogMetadataReranker");
const {
    isVisualMatchItem,
    buildVisionFromVisualMatches,
    expandFromVisualSeeds,
    buildImageSearchListMeta,
    buildRelevanceContext,
    filterImageSearchResults,
    filterSupplementalItems,
} = require("../../products/services/visualFirstImageSearchHelper");
const { getEmbedding, cosineSimilarity } = require("./embeddingService");
const { getSimilarProducts } = require("../../products/services/similarProductsService");

const isSmartImageSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(process.env.DASHSCOPE_SMART_IMAGE_SEARCH ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const isFastImageSearchEnabled = () => {
    const flag = String(process.env.IMAGE_SEARCH_FAST ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

/** 1688 is off by default — image search targets your Mongo catalog. Set IMAGE_SEARCH_INCLUDE_1688=true to enable. */
const is1688ImageSearchEnabled = () => {
    const flag = String(process.env.IMAGE_SEARCH_INCLUDE_1688 ?? "false").toLowerCase();
    return flag === "1" || flag === "true";
};

const ALIBABA_SEARCH_BUDGET_MS = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_ALIBABA_BUDGET_MS || 18000), 5000),
    45000
);

const ALIBABA_ENHANCED_BUDGET_MS = Math.min(
    Math.max(
        Number(process.env.IMAGE_SEARCH_1688_ENHANCED_BUDGET_MS || ALIBABA_SEARCH_BUDGET_MS * 2),
        ALIBABA_SEARCH_BUDGET_MS
    ),
    60000
);

const getSearchCatalogForImage = () =>
    require("../../products/services/catalogSearchService").searchCatalogForImage;

const getBuildImageSearchCatalogNeedles = () =>
    require("../../products/services/catalogSearchService").buildImageSearchCatalogNeedles;

const getRankImageSearchNeedles = () =>
    require("../../products/services/catalogSearchService").rankImageSearchNeedles;

const getSearchCatalogByText = () =>
    require("../../products/services/catalogSearchService").searchCatalogByText;

const itemKey = (item) => String(item?._id || item?.offerId || "");

const mergeItems = (target = [], incoming = [], { scoreBoost = 0 } = {}) => {
    const indexByKey = new Map(target.map((item, index) => [itemKey(item), index]));
    incoming.forEach((item) => {
        const key = itemKey(item);
        if (!key) return;

        const incomingScore = Number(item.match_score || item.similarity_score || 0) + scoreBoost;
        const existingIndex = indexByKey.get(key);

        if (existingIndex !== undefined) {
            const existing = target[existingIndex];
            const existingScore = Number(existing.match_score || existing.similarity_score || 0);
            if (item.similarity_score
                && (!existing.similarity_score || item.similarity_score > existing.similarity_score)) {
                existing.similarity_score = item.similarity_score;
            }
            const minSim = Math.min(
                Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_MIN_SIMILARITY || 0.48), 0),
                1
            );
            const incomingStrongVisual =
                item.match_type === "visual"
                && Number(item.similarity_score || 0) >= minSim;
            const existingStrongVisual =
                existing.match_type === "visual"
                && Number(existing.similarity_score || 0) >= minSim;
            if (incomingStrongVisual || existingStrongVisual) {
                existing.match_type = "visual";
            } else if (item.match_type === "weak_visual" && existing.match_type !== "visual") {
                existing.match_type = "weak_visual";
            }
            existing.match_score = Number(Math.max(existingScore, incomingScore).toFixed(4));
            return;
        }

        const next = { ...item };
        if (scoreBoost > 0) {
            next.match_score = Number(
                (Number(next.match_score || next.similarity_score || 0) + scoreBoost).toFixed(4)
            );
        }
        indexByKey.set(key, target.length);
        target.push(next);
    });
    return target;
};

const normalizeCatalogItems = (items = []) =>
    (items || []).map((item) => {
        const img = item?.featured_image;
        if (img && typeof img === "object" && img.link) {
            return { ...item, featured_image: img.link };
        }
        return item;
    });

const visionFromFallbackSearch = (text = "") => {
    const phrase = String(text || "").trim();
    if (!phrase) return null;
    return {
        provider: "search_param",
        objectLabel: phrase,
        primaryKeyword: phrase,
        keywords: phrase.split(/\s+/).filter((word) => word.length > 2).slice(0, 8),
        searchPhrase: phrase,
    };
};

const inferVisionFromItems = (items = []) => {
    const top = (items || []).find((item) => String(item?.name || "").trim());
    if (!top) return null;
    const name = String(top.name).trim();
    if (!name || name === "Product") return null;
    const label = name.split(/\s+/).slice(0, 5).join(" ");
    return {
        provider: "match-inference",
        objectLabel: label,
        primaryKeyword: label,
        keywords: name.split(/\s+/).filter((word) => word.length > 2).slice(0, 6),
        searchPhrase: name,
    };
};

const isVisualFirstImageSearch = () =>
    String(process.env.IMAGE_SEARCH_VISUAL_FIRST ?? "true").toLowerCase() !== "false";

const minVisualResultsForPrimary = () =>
    Math.max(Number(process.env.IMAGE_SEARCH_VISUAL_MIN_RESULTS || 2), 1);

/** Visual matches first (highest % on top), then everything else by relevance score.
 *  Dual visual+keyword hits rank above visual-only or keyword-only. */
const prioritizeVisualMatches = (items = []) => {
    const dual = [];
    const visual = [];
    const rest = [];

    (items || []).forEach((item) => {
        const signals = item?.match_signals || [];
        const isDual = signals.includes("visual+keyword")
            || (isVisualMatchItem(item) && Number(item?.keyword_hit_count || 0) >= 1);
        if (isDual) dual.push(item);
        else if (isVisualMatchItem(item)) visual.push(item);
        else rest.push(item);
    });

    const byVisualThenScore = (a, b) => {
        const simDiff = Number(b.similarity_score || 0) - Number(a.similarity_score || 0);
        if (simDiff !== 0) return simDiff;
        return Number(b.match_score || b._score || 0) - Number(a.match_score || a._score || 0);
    };

    dual.sort(byVisualThenScore);
    visual.sort(byVisualThenScore);
    rest.sort((a, b) => {
        const scoreA = Number(a.match_score || a._score || 0);
        const scoreB = Number(b.match_score || b._score || 0);
        return scoreB - scoreA;
    });

    return [...dual, ...visual, ...rest];
};

const rankItems = (items = []) => prioritizeVisualMatches(items);

const normalizeMatchText = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const tokenizeMatchText = (value = "") =>
    normalizeMatchText(value).split(" ").filter((word) => word.length > 2);

/**
 * Fuse visual comparison scores with keywords extracted from the image scan.
 * Items that agree on both signals rise; visual-only mismatches are demoted.
 */
const fuseVisualAndKeywordMatches = (items = [], vision = null) => {
    if (!Array.isArray(items) || !items.length) return [];

    const attrs = vision?.attributes || {};
    const keywordPool = [
        attrs.product_type,
        vision?.objectLabel,
        vision?.primaryKeyword,
        vision?.searchPhrase,
        ...(Array.isArray(vision?.keywords) ? vision.keywords.slice(0, 10) : []),
        ...(Array.isArray(attrs.colors) ? attrs.colors.slice(0, 3) : []),
        ...(Array.isArray(attrs.materials) ? attrs.materials.slice(0, 3) : []),
        attrs.shape,
        attrs.style,
        attrs.brand_or_logo,
    ].filter(Boolean);

    const typeTokens = new Set();
    const featureTokens = new Set();
    keywordPool.forEach((value, index) => {
        tokenizeMatchText(value).forEach((token) => {
            if (index < 4) typeTokens.add(token);
            featureTokens.add(token);
        });
    });

    return (items || []).map((item) => {
        if (!item || typeof item !== "object") return item;

        const name = normalizeMatchText(item.name || "");
        const desc = normalizeMatchText(item.short_description || "");
        const haystack = `${name} ${desc}`;
        const itemTokens = new Set(tokenizeMatchText(haystack));

        let typeHits = 0;
        typeTokens.forEach((token) => {
            if (itemTokens.has(token) || name.includes(token)) typeHits += 1;
        });

        let featureHits = 0;
        featureTokens.forEach((token) => {
            if (itemTokens.has(token) || haystack.includes(token)) featureHits += 1;
        });

        const isVisual = isVisualMatchItem(item);
        const signals = [];
        if (isVisual) signals.push("visual");
        if (typeHits >= 1 || featureHits >= 2) signals.push("keyword");
        if (isVisual && (typeHits >= 1 || featureHits >= 2)) signals.push("visual+keyword");

        let boost = 0;
        if (typeHits >= 1) boost += typeHits * 8;
        if (featureHits >= 2) boost += Math.min(featureHits, 6) * 2;
        if (signals.includes("visual+keyword")) boost += 24;
        if (isVisual && typeTokens.size >= 2 && typeHits === 0) boost -= 18;

        const base = Number(item.match_score || item.similarity_score || item._score || 0);
        const next = {
            ...item,
            keyword_hit_count: typeHits + featureHits,
            keyword_type_hits: typeHits,
            match_signals: signals,
            match_score: Number((base + boost).toFixed(4)),
        };

        // Visual hit that completely disagrees with scanned product type → weak_visual.
        if (
            isVisual
            && typeTokens.size >= 2
            && typeHits === 0
            && Number(item.similarity_score || 0) < 0.7
        ) {
            next.match_type = "weak_visual";
        }

        return next;
    });
};


const VISION_CACHE = new Map();
const VISION_CACHE_TTL_MS = 10 * 60 * 1000;

const visionCacheKey = (imageUrl = "") =>
    guessLocalImagePath(imageUrl) || String(imageUrl || "").trim();

const getCachedVision = (imageUrl) => {
    const key = visionCacheKey(imageUrl);
    if (!key) return null;
    const entry = VISION_CACHE.get(key);
    if (!entry || Date.now() - entry.ts > VISION_CACHE_TTL_MS) {
        VISION_CACHE.delete(key);
        return null;
    }
    return entry.value;
};

const setCachedVision = (imageUrl, vision) => {
    const key = visionCacheKey(imageUrl);
    if (!key || !vision?.primaryKeyword) return;
    VISION_CACHE.set(key, { value: vision, ts: Date.now() });
    while (VISION_CACHE.size > 40) {
        VISION_CACHE.delete(VISION_CACHE.keys().next().value);
    }
};

const primeVisionCache = (imageUrl, vision) => setCachedVision(imageUrl, vision);

const localImageIndexPath = () =>
    process.env.LOCAL_IMAGE_SEARCH_INDEX
    || path.resolve(process.cwd(), "data", "image-search", "products.index.faiss");

const hasLocalImageIndex = () => {
    try {
        return fs.existsSync(localImageIndexPath());
    } catch (_) {
        return false;
    }
};

const resolveVision = async (imageUrl, fallbackSearch = "") => {
    let vision = getCachedVision(imageUrl);
    if (!vision?.primaryKeyword && isAiImageSearchEnabled()) {
        try {
            vision = await extractImageSearchKeywords(imageUrl);
            if (vision?.primaryKeyword) setCachedVision(imageUrl, vision);
        } catch (err) {
            console.warn("[smart-image-search] Vision failed:", err.message);
        }
    }
    if (!vision?.primaryKeyword && fallbackSearch) {
        vision = visionFromFallbackSearch(fallbackSearch);
    }
    return vision;
};

/**
 * Image search — scan every visible feature first, then match catalog products to those features.
 * Visual (pHash) similarity runs in parallel and boosts exact photo matches.
 */
const VISUAL_SEARCH_BUDGET_MS = Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_BUDGET_MS || 8000), 3000),
    25000
);

const FEATURE_SCAN_BUDGET_MS = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_FEATURE_SCAN_BUDGET_MS || 12000), 4000),
    35000
);

/** When local visual hits are strong enough, skip slow keyword/embedding fallbacks. */
const STRONG_VISUAL_SIMILARITY = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_STRONG_VISUAL_SIMILARITY || 0.58), 0.45),
    0.95
);

const isFeatureFirstImageSearch = () =>
    String(process.env.IMAGE_SEARCH_FEATURE_FIRST ?? "true").toLowerCase() !== "false";

const resolveSmartImageSearch = async ({
    imageUrl,
    limit = 24,
    skip = 1,
    category,
    fieldName,
    fieldValue,
    country = "en",
    fast = isFastImageSearchEnabled(),
    fallbackSearch = "",
} = {}) => {
    const pageLimit = Math.max(1, Math.min(Number(limit) || 24, 48));
    const minVisual = minVisualResultsForPrimary();
    const minResults = Math.min(3, pageLimit);
    const mongoReady = isMongoConnected();
    const embeddingPrimaryEnabled = String(process.env.IMAGE_SEARCH_EMBEDDING_PRIMARY ?? "true").toLowerCase() !== "false";

    let items = [];
    let provider = "none";
    let vision = null;
    let searchMode = "keyword";
    let relevanceContext = buildRelevanceContext(null, []);

    // 1) Scan image features (VL) + visual photo match in parallel
    const featureScanPromise = imageUrl && isAiImageSearchEnabled()
        ? withPromiseTimeout(resolveVision(imageUrl, fallbackSearch), FEATURE_SCAN_BUDGET_MS, null)
        : Promise.resolve(fallbackSearch ? visionFromFallbackSearch(fallbackSearch) : null);

    const visualPromise = imageUrl && isLocalImageSearchEnabled()
        ? withPromiseTimeout(
            runLocalVisualSearch({ imageAddress: imageUrl, pageLimit }),
            VISUAL_SEARCH_BUDGET_MS,
            null
        )
        : Promise.resolve(null);

    const [featureVision, localVisual] = await Promise.all([featureScanPromise, visualPromise]);

    if (featureVision?.primaryKeyword) {
        vision = {
            ...featureVision,
            searchMode: "feature",
        };
        relevanceContext = buildRelevanceContext(vision, []);
        console.log(
            `[smart-image-search] feature scan: ${vision.objectLabel || vision.primaryKeyword}`
            + (vision.featureSummary ? ` | ${String(vision.featureSummary).slice(0, 160)}` : "")
        );
    } else if (fallbackSearch) {
        vision = visionFromFallbackSearch(fallbackSearch);
    }

    if (localVisual?.items?.length) {
        mergeItems(items, normalizeCatalogItems(localVisual.items));
        provider = localVisual.provider || "local-visual";
        console.log(`[smart-image-search] visual matches=${localVisual.items.length}`);
    }

    const visualMatches = items.filter(isVisualMatchItem);
    const visualCount = visualMatches.length;
    const topVisualSimilarity = visualMatches.reduce(
        (max, item) => Math.max(max, Number(item.similarity_score || 0)),
        0
    );
    const strongVisualPrimary =
        visualCount >= minVisual
        && topVisualSimilarity >= STRONG_VISUAL_SIMILARITY;

    // 2) ALWAYS search catalog with keywords extracted from the image scan,
    //    and keep visual comparison results. Both signals are fused later.
    const primaryKeyword = vision?.primaryKeyword || vision?.searchPhrase || vision?.objectLabel || "";
    const keywords = (vision?.keywords || []).slice(0, 12);
    const searchPhrase = vision?.searchPhrase || primaryKeyword;
    const hasFeatureNeedles = Boolean(primaryKeyword || searchPhrase || keywords.length);

    if (hasFeatureNeedles) {
        if (visualCount > 0) searchMode = "feature+visual";
        else searchMode = "feature";

        provider = provider === "none"
            ? (vision?.provider || "ai-vision")
            : `${provider}+feature-match`;

        // Refresh relevance context with scanned keywords before filtering supplements.
        relevanceContext = buildRelevanceContext(vision, visualMatches);

        const catalogNeedles = await require("../../products/services/catalogVocabularyService")
            .expandNeedlesForImageSearch({
                needles: getBuildImageSearchCatalogNeedles()({
                    primaryKeyword,
                    searchPhrase,
                    objectLabel: vision?.objectLabel || "",
                    keywords,
                    categoryHint: vision?.attributes?.category || "",
                    attributes: vision?.attributes || {},
                }),
                primaryKeyword,
                searchPhrase,
                objectLabel: vision?.objectLabel || "",
                keywords,
                categoryHint: vision?.attributes?.category || "",
            });

        console.log(`[smart-image-search] feature needles: ${getRankImageSearchNeedles()(catalogNeedles).join("|")}`);

        try {
            const catalogResult = await getSearchCatalogForImage()({
                search: primaryKeyword || searchPhrase,
                // Keep keyword search active even with strong visual hits.
                limit: strongVisualPrimary ? Math.min(pageLimit, 16) : pageLimit,
                skip,
                category,
                fieldName,
                fieldValue,
                vision,
            });
            const catalogItems = normalizeCatalogItems(catalogResult?.items || []).map((item) => ({
                ...item,
                match_type: item.match_type || "keyword",
                match_signals: ["keyword"],
            }));
            if (catalogItems.length) {
                const filtered = filterSupplementalItems(catalogItems, relevanceContext);
                // Visual already present → smaller boost; keywords alone → larger boost.
                mergeItems(items, filtered, { scoreBoost: visualCount ? 4 : 10 });
                const engine = catalogResult?.engine || "catalog";
                provider = engine === "elasticsearch"
                    ? `${provider}+catalog-es`
                    : `${provider}+catalog-mongo`;
            }
        } catch (catalogErr) {
            console.warn("[smart-image-search] feature catalog failed:", catalogErr?.message || catalogErr);
        }

        // Embedding search from the scanned search phrase (lighter when visual is already strong).
        if (
            embeddingPrimaryEnabled
            && mongoReady
            && (searchPhrase || primaryKeyword)
        ) {
            try {
                const embedded = await searchCatalogByEmbeddingPhrase(
                    searchPhrase || primaryKeyword,
                    { limit: strongVisualPrimary ? Math.min(pageLimit, 10) : pageLimit }
                );
                if (embedded.length) {
                    const taggedEmbed = embedded.map((item) => ({
                        ...item,
                        match_type: item.match_type || "embedding",
                        match_signals: ["keyword"],
                    }));
                    const filteredEmbed = filterSupplementalItems(taggedEmbed, relevanceContext);
                    mergeItems(items, filteredEmbed, { scoreBoost: visualCount ? 2 : 7 });
                    provider = `${provider}+embedding`;
                }
            } catch (embedErr) {
                console.warn("[smart-image-search] embedding match failed:", embedErr?.message || embedErr);
            }
        }

        // Text fallback only when neither visual nor keyword catalog produced enough.
        if (visualCount === 0 && items.length < pageLimit) {
            try {
                const textResult = await getSearchCatalogByText()({
                    search: primaryKeyword || searchPhrase,
                    limit: pageLimit,
                    skip,
                    category,
                    fieldName,
                    fieldValue,
                    fast: true,
                    skipExternal: true,
                });
                const textItems = normalizeCatalogItems(textResult?.items || []).map((item) => ({
                    ...item,
                    match_type: item.match_type || "keyword",
                    match_signals: ["keyword"],
                }));
                const filteredText = filterSupplementalItems(textItems, relevanceContext);
                if (filteredText.length) {
                    mergeItems(items, filteredText, { scoreBoost: 2 });
                    provider = `${provider}+catalog-text`;
                }
            } catch (textErr) {
                console.warn("[smart-image-search] catalog text fallback failed:", textErr?.message || textErr);
            }
        }
    } else if (visualCount > 0) {
        searchMode = "visual";
    }

    if (strongVisualPrimary && hasFeatureNeedles) {
        console.log(
            `[smart-image-search] visual+keyword fusion topVisual=${topVisualSimilarity.toFixed(3)} kw="${primaryKeyword}"`
        );
    }

    // 3) Optional expansion from strong visual seeds
    if (visualCount > 0) {
        const expansion = await expandFromVisualSeeds({
            seeds: visualMatches,
            pageLimit,
            skip,
            category,
            fieldName,
            fieldValue,
        });
        if (!vision?.primaryKeyword) {
            vision = expansion.vision || buildVisionFromVisualMatches(visualMatches);
            searchMode = "visual";
        } else if (expansion.vision?.topVisualMatchName) {
            vision = {
                ...vision,
                topVisualMatchName: expansion.vision.topVisualMatchName,
            };
        }
        relevanceContext = buildRelevanceContext(vision, visualMatches);
        if (expansion.catalogItems?.length) {
            mergeItems(items, normalizeCatalogItems(expansion.catalogItems), { scoreBoost: 1 });
            provider = `${provider}+visual-catalog`;
        }
        if (expansion.similarItems?.length) {
            mergeItems(items, normalizeCatalogItems(expansion.similarItems), { scoreBoost: 0 });
            provider = `${provider}+visual-similar`;
        }
        if (searchMode === "keyword") searchMode = "visual";
    }

    // 4) 1688 only when visual/feature search found nothing useful
    if (imageUrl && is1688EnhancedImageSearchEnabled() && visualCount === 0 && items.length < minResults) {
        try {
            const enhanced1688 = await withPromiseTimeout(
                runEnhanced1688ImageSearch({
                    imageUrl,
                    pageLimit,
                    pageSkip: skip,
                    country,
                    imageKeywords: primaryKeyword || vision?.fallbackKeyword || "",
                }),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            );
            if (enhanced1688?.items?.length) {
                mergeItems(items, normalizeCatalogItems(enhanced1688.items), { scoreBoost: 3 });
                provider = `${provider}+alibaba-enhanced`;
            }
        } catch (error) {
            console.warn("[smart-image-search] 1688 enhanced failed:", error?.message || error);
        }
    }

    if (items.length < minResults && imageUrl && is1688ImageSearchEnabled() && visualCount === 0) {
        try {
            const alibabaVisual = await withPromiseTimeout(
                is1688EnhancedImageSearchEnabled()
                    ? runEnhanced1688ImageSearch({ imageUrl, pageLimit, pageSkip: skip, country })
                    : runAlibabaImageSearch({ imageUrl, pageLimit, pageSkip: skip, country }),
                is1688EnhancedImageSearchEnabled() ? ALIBABA_ENHANCED_BUDGET_MS : ALIBABA_SEARCH_BUDGET_MS,
                null
            );
            if (alibabaVisual?.items?.length) {
                mergeItems(items, normalizeCatalogItems(alibabaVisual.items), { scoreBoost: 4 });
                provider = `${provider}+alibaba-visual`;
            }
        } catch (error) {
            console.warn("[smart-image-search] 1688 visual fallback failed:", error?.message || error);
        }

        if ((primaryKeyword || vision?.fallbackKeyword || vision?.primaryKeyword)) {
            try {
                const alibabaItems = await withPromiseTimeout(
                    searchAlibabaCatalogByKeywords({
                        primaryKeyword: primaryKeyword || vision.fallbackKeyword || vision.primaryKeyword,
                        keywords: vision.keywords || [],
                        pageLimit,
                        pageSkip: skip,
                        country,
                    }),
                    ALIBABA_SEARCH_BUDGET_MS,
                    []
                );
                if (alibabaItems?.length) {
                    mergeItems(items, alibabaItems, { scoreBoost: 2 });
                    provider = `${provider}+alibaba-kw`;
                }
            } catch (error) {
                console.warn("[smart-image-search] alibaba-kw fallback failed:", error?.message || error);
            }
        }
    }

    relevanceContext = buildRelevanceContext(vision, items.filter(isVisualMatchItem));
    // Fuse visual comparison + scanned keywords before rerank/filter.
    items = fuseVisualAndKeywordMatches(items, vision);
    items = rankItems(items);
    const rerankVision = vision || buildVisionFromVisualMatches(items.filter(isVisualMatchItem));
    if (items.length && rerankVision) {
        try {
            items = await rerankImageSearchItems(items, rerankVision);
            // Re-apply fusion after metadata/semantic rerank so dual matches stay on top.
            items = fuseVisualAndKeywordMatches(items, rerankVision);
        } catch (rerankErr) {
            console.warn("[smart-image-search] rerank failed:", rerankErr?.message || rerankErr);
        }
    }
    items = filterImageSearchResults(items, relevanceContext, { pageLimit });
    items = prioritizeVisualMatches(items).slice(0, pageLimit);

    if (!vision && items.length) {
        vision = buildVisionFromVisualMatches(items.filter(isVisualMatchItem))
            || inferVisionFromItems(items);
        if (vision) searchMode = isVisualMatchItem(items[0]) ? "visual" : "keyword";
    }
    if (vision) {
        const hasDual = items.some((item) => (item.match_signals || []).includes("visual+keyword"));
        if (hasDual) searchMode = "feature+visual";
        vision.searchMode = searchMode;
    }

    if (!items.length) {
        console.warn(
            `[smart-image-search] no results mode=${searchMode} visual=${visualCount} features=${hasFeatureNeedles}`
        );
    } else {
        console.log(
            `[smart-image-search] done mode=${searchMode} visual=${visualCount} items=${items.length} provider=${provider}`
        );
    }

    return {
        items,
        recommendations: [],
        smartListing: null,
        vision,
        provider,
        searchMode,
        total: items.length ? Math.max(items.length, 500) : 0,
    };
};

const searchSimilarByEmbedding = async (searchPhrase, { limit = 24, excludeIds = [] } = {}) => {
    const text = String(searchPhrase || "").trim();
    if (!text || !isDashscopeConfigured()) return [];

    const cap = Math.max(1, Math.min(Number(limit) || 24, 48));
    const exclude = new Set((excludeIds || []).map(String));
    const queryVector = await getEmbedding(text.slice(0, 2000));

    const candidates = await Product.find({
        status: "active",
        embedding: { $exists: true, $type: "array", $ne: [] },
    })
        .select("name price compare_price images featured_image average_rating rating_count short_description categories offerId slug embedding")
        .limit(120)
        .lean();

    return candidates
        .map((item) => ({
            item,
            score: cosineSimilarity(queryVector, item.embedding),
        }))
        .filter((row) => {
            const minScore = Math.min(
                Math.max(Number(process.env.IMAGE_SEARCH_EMBEDDING_MIN_SCORE || 0.32), 0.05),
                0.95
            );
            return row.score >= minScore && !exclude.has(String(row.item._id));
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, cap)
        .map((row) => ({
            ...row.item,
            similarity_score: Number(row.score.toFixed(4)),
            match_score: Number(row.score.toFixed(4)),
            match_type: "embedding",
        }));
};

const resolveSearchRecommendations = async (searchQuery, mainItems = [], { limit = 8 } = {}) => {
    const query = String(searchQuery || "").trim();
    if (!query) return [];

    const recommendations = [];
    const mainKeys = new Set(mainItems.map(itemKey));

    for (const productId of mainItems.filter((i) => i._id).slice(0, 3).map((i) => i._id)) {
        try {
            const similar = await getSimilarProducts(productId, { limit: 4 });
            mergeItems(recommendations, similar);
        } catch (err) {
            console.warn("[smart-image-search] similar products failed:", err.message);
        }
        if (recommendations.length >= limit) break;
    }

    if (recommendations.length < limit && isDashscopeConfigured()) {
        const embedRecs = await searchSimilarByEmbedding(query, {
            limit: limit - recommendations.length,
            excludeIds: [...mainItems.map((i) => i._id), ...recommendations.map((r) => r._id)],
        });
        mergeItems(recommendations, embedRecs);
    }

    return recommendations.filter((item) => !mainKeys.has(itemKey(item))).slice(0, limit);
};

module.exports = {
    isSmartImageSearchEnabled,
    isFastImageSearchEnabled,
    resolveSmartImageSearch,
    resolveSearchRecommendations,
    searchSimilarByEmbedding,
    buildImageSearchListMeta,
    primeVisionCache,
    getCachedVision,
};
