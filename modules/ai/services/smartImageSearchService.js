/**
 * Smart image search: Qwen-VL → Elasticsearch catalog (primary), Mongo fallback, optional 1688.
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
    searchAlibabaCatalogByKeywords,
    runLocalVisualSearch,
} = require("../../products/helper/imageSearchPipeline");
const { guessLocalImagePath } = require("../helpers/resolveVisionImageInput");
const { isMongoConnected } = require("../../../config/db");
const { withPromiseTimeout } = require("../../../utils/mongoQueryOptions");
const Product = require("../../../models/productsTable");
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
    const seen = new Set(target.map(itemKey));
    incoming.forEach((item) => {
        const key = itemKey(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        if (scoreBoost > 0) {
            item.match_score = Number((Number(item.match_score || 0) + scoreBoost).toFixed(4));
        }
        target.push(item);
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

const rankItems = (items = []) =>
    [...items].sort((a, b) => {
        const scoreA = Number(a.match_score || a.similarity_score || a._score || 0);
        const scoreB = Number(b.match_score || b.similarity_score || b._score || 0);
        return scoreB - scoreA;
    });

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
 * Image search — Qwen-VL keywords → Elasticsearch catalog (primary), Mongo fallback, optional 1688.
 */
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
    let items = [];
    let provider = "none";

    const vision = await resolveVision(imageUrl, fallbackSearch);
    const primaryKeyword = vision?.primaryKeyword || vision?.searchPhrase || vision?.objectLabel || "";
    const keywords = (vision?.keywords || []).slice(0, 6);
    const searchPhrase = vision?.searchPhrase || primaryKeyword;
    const minResults = Math.min(3, pageLimit);
    const catalogNeedles = getBuildImageSearchCatalogNeedles()({
        primaryKeyword,
        searchPhrase,
        objectLabel: vision?.objectLabel || "",
        keywords,
    });
    const mongoReady = isMongoConnected();

    if (primaryKeyword || searchPhrase) {
        provider = vision?.provider || "ai-vision";
    }

    if (catalogNeedles.length || primaryKeyword || searchPhrase) {
        const ranked = getRankImageSearchNeedles()(catalogNeedles);
        console.log(`[smart-image-search] catalog needles: ${ranked.join("|")}`);
        try {
            const catalogResult = await getSearchCatalogForImage()({
                search: primaryKeyword || searchPhrase,
                limit: pageLimit,
                skip,
                category,
                fieldName,
                fieldValue,
                vision,
            });
            const catalogItems = normalizeCatalogItems(catalogResult?.items || []);
            if (catalogItems.length) {
                mergeItems(items, catalogItems, { scoreBoost: 6 });
                const engine = catalogResult?.engine || "catalog";
                provider = engine === "elasticsearch"
                    ? `${provider === "none" ? "ai-vision" : provider}+catalog-es`
                    : `${provider === "none" ? "ai-vision" : provider}+catalog-mongo`;
            }
        } catch (catalogErr) {
            console.warn("[smart-image-search] catalog search failed:", catalogErr?.message || catalogErr);
        }
    }

    if (items.length < pageLimit && (primaryKeyword || searchPhrase)) {
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
            const textItems = normalizeCatalogItems(textResult?.items || []);
            if (textItems.length) {
                mergeItems(items, textItems, { scoreBoost: 4 });
                const textEngine = textResult?.searchMeta?.engine || "catalog-text";
                provider = provider === "none"
                    ? `catalog-text-${textEngine}`
                    : `${provider}+catalog-text-${textEngine}`;
            }
        } catch (textErr) {
            console.warn("[smart-image-search] catalog text search failed:", textErr?.message || textErr);
        }
    }

    const embeddingFallbackEnabled = String(process.env.IMAGE_SEARCH_EMBEDDING_FALLBACK || "true").toLowerCase() === "true";

    if (embeddingFallbackEnabled && items.length < pageLimit && mongoReady && catalogNeedles.length) {
        try {
            const embedPhrase = catalogNeedles.find((n) => n.includes(" ")) || catalogNeedles[0] || primaryKeyword;
            const embedded = await searchCatalogByEmbeddingPhrase(embedPhrase, { limit: pageLimit });
            if (embedded.length) {
                mergeItems(items, embedded, { scoreBoost: 2 });
                provider = provider === "none" ? "embedding" : `${provider}+embedding`;
            }
        } catch (embedErr) {
            console.warn("[smart-image-search] embedding fallback failed:", embedErr?.message || embedErr);
        }
    }

    if (items.length < minResults && (primaryKeyword || imageUrl) && is1688ImageSearchEnabled()) {
        console.log("[smart-image-search] 1688 fallback enabled — querying external marketplace");
        const retrievalTasks = [];

        if (primaryKeyword || searchPhrase) {
            retrievalTasks.push((async () => {
                try {
                    const alibabaItems = await withPromiseTimeout(
                        searchAlibabaCatalogByKeywords({
                            primaryKeyword: primaryKeyword || searchPhrase,
                            keywords,
                            pageLimit,
                            pageSkip: skip,
                            country,
                        }),
                        ALIBABA_SEARCH_BUDGET_MS,
                        []
                    );
                    return { items: alibabaItems || [], scoreBoost: 3, tag: "alibaba-kw" };
                } catch (error) {
                    console.warn("[smart-image-search] alibaba-kw failed:", error?.message || error);
                    return { items: [], scoreBoost: 0, tag: "alibaba-kw-error" };
                }
            })());
        }

        if (imageUrl) {
            retrievalTasks.push((async () => {
                try {
                    const alibabaVisual = await withPromiseTimeout(
                        runAlibabaImageSearch({
                            imageUrl,
                            pageLimit,
                            pageSkip: skip,
                            country,
                        }),
                        ALIBABA_SEARCH_BUDGET_MS,
                        null
                    );
                    return {
                        items: alibabaVisual?.items || [],
                        scoreBoost: 5,
                        tag: "alibaba-visual",
                    };
                } catch (error) {
                    console.warn("[smart-image-search] alibaba-visual failed:", error?.message || error);
                    return { items: [], scoreBoost: 0, tag: "alibaba-visual-error" };
                }
            })());
        }

        if (imageUrl && guessLocalImagePath(imageUrl) && hasLocalImageIndex()) {
            retrievalTasks.push((async () => {
                const localMatch = await runLocalVisualSearch({ imageAddress: imageUrl, pageLimit });
                return {
                    items: localMatch?.items || [],
                    scoreBoost: 2.5,
                    tag: "local",
                };
            })());
        }

        const settled = await Promise.allSettled(retrievalTasks);
        settled.forEach((result) => {
            if (result.status === "rejected") {
                console.warn("[smart-image-search] retrieval rejected:", result.reason?.message || result.reason);
                return;
            }
            if (result.status !== "fulfilled") return;
            const { items: batch = [], scoreBoost = 0, tag } = result.value || {};
            if (!batch.length) return;
            mergeItems(items, batch, { scoreBoost });
            provider = provider === "none" ? tag : `${provider}+${tag}`;
        });
    }

    items = rankItems(items).slice(0, pageLimit);

    if (!items.length) {
        console.warn(
            `[smart-image-search] no results keyword="${searchPhrase || primaryKeyword}" needles=${catalogNeedles.join("|")}`
        );
    }

    let finalVision = vision;
    if ((!finalVision?.primaryKeyword && !finalVision?.objectLabel) && items.length) {
        finalVision = { ...(finalVision || {}), ...inferVisionFromItems(items) };
    }

    return {
        items,
        recommendations: [],
        smartListing: null,
        vision: finalVision,
        provider,
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
        .filter((row) => row.score > 0.18 && !exclude.has(String(row.item._id)))
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
    primeVisionCache,
    getCachedVision,
};
