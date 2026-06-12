/**
 * Smart image search: Qwen-VL smart listing → embedding similarity → catalog → recommendations.
 */
const { isDashscopeConfigured } = require("../dashscopeClient");
const { runSmartListing, analyzeProductImage } = require("./smartListingService");
const {
    searchCatalogByKeywords,
    searchCatalogByEmbeddingPhrase,
    extractImageSearchKeywords,
    isAiImageSearchEnabled,
} = require("./aiImageSearchService");
const {
    runImageSearchPipeline,
    runAlibabaImageSearch,
    searchAlibabaCatalogByKeywords,
    resolveActiveCatalogItems,
} = require("../../products/helper/imageSearchPipeline");
const { getSimilarProducts } = require("../../products/services/similarProductsService");
const { getEmbedding, cosineSimilarity } = require("./embeddingService");
const Product = require("../../../models/productsTable");

const isSmartImageSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(process.env.DASHSCOPE_SMART_IMAGE_SEARCH ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const itemKey = (item) => String(item?._id || item?.offerId || "");

const mergeItems = (target = [], incoming = [], { scoreBoost = 0 } = {}) => {
    const seen = new Set(target.map(itemKey));
    incoming.forEach((item) => {
        const key = itemKey(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        if (scoreBoost > 0) {
            item.match_score = Number((item.match_score || 0) + scoreBoost).toFixed(4);
        }
        target.push(item);
    });
    return target;
};

const buildSmartListingSearchContext = (smartListing) => {
    const attrs = smartListing?.attributes || {};
    const listing = smartListing?.listing || {};

    const primaryKeyword =
        listing.title_en
        || attrs.product_type
        || attrs.category
        || "";

    const keywords = [
        attrs.color,
        attrs.material,
        attrs.size,
        attrs.product_type,
        attrs.category,
        ...(Array.isArray(listing.seo_tags) ? listing.seo_tags : []),
    ].filter(Boolean);

    const searchPhrase = [
        listing.title_en,
        listing.description_en,
        attrs.product_type,
        attrs.category,
        attrs.color,
        attrs.material,
        attrs.visible_text,
    ]
        .filter(Boolean)
        .join(" ")
        .trim();

    return { primaryKeyword, keywords, searchPhrase, attributes: attrs, listing };
};

/**
 * Find visually/semantically similar products using embedding of smart-listing text.
 */
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
        .populate({ path: "featured_image", select: "link -_id" })
        .limit(500)
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

const collectRecommendations = async (mainItems = [], searchPhrase = "", { limit = 12 } = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 12, 24));
    const recommendations = [];
    const mainKeys = new Set(mainItems.map(itemKey));

    // Similar to top catalog matches
    const topIds = mainItems
        .filter((i) => i._id)
        .slice(0, 3)
        .map((i) => i._id);

    for (const productId of topIds) {
        try {
            const similar = await getSimilarProducts(productId, { limit: 4 });
            mergeItems(recommendations, similar.map((row) => ({
                ...row,
                match_type: "similar_product",
            })), {});
        } catch (err) {
            console.warn("[smart-image-search] similar products failed:", err.message);
        }
        if (recommendations.length >= cap) break;
    }

    // Embedding discovery from smart listing phrase
    if (recommendations.length < cap && searchPhrase) {
        const embedRecs = await searchSimilarByEmbedding(searchPhrase, {
            limit: cap - recommendations.length,
            excludeIds: [...mainKeys, ...recommendations.map((r) => r._id)],
        });
        mergeItems(recommendations, embedRecs);
    }

    return recommendations
        .filter((item) => !mainKeys.has(itemKey(item)))
        .slice(0, cap);
};

const resolveVisionFromImage = async (imageUrl) => {
    if (!isSmartImageSearchEnabled() && !isAiImageSearchEnabled()) {
        return null;
    }

    try {
        const kw = await extractImageSearchKeywords(imageUrl);
        if (kw?.primaryKeyword) return kw;
    } catch (kwErr) {
        console.warn("[smart-image-search] Vision keyword extract failed:", kwErr.message);
    }

    try {
        const attrs = await analyzeProductImage(imageUrl);
        const ctx = buildSmartListingSearchContext({ attributes: attrs });
        if (ctx.primaryKeyword || ctx.searchPhrase) {
            return {
                provider: "smart-listing-attributes",
                objectLabel: attrs?.product_type || ctx.primaryKeyword || "",
                primaryKeyword: ctx.primaryKeyword,
                keywords: ctx.keywords,
                searchPhrase: ctx.searchPhrase,
                attributes: attrs,
            };
        }
    } catch (attrErr) {
        console.warn("[smart-image-search] Attribute extract failed:", attrErr.message);
    }

    if (!isSmartImageSearchEnabled()) return null;

    try {
        const smartListing = await runSmartListing({ imageUrl });
        const ctx = buildSmartListingSearchContext(smartListing);
        return {
            provider: "smart-listing",
            objectLabel: ctx.primaryKeyword || smartListing?.attributes?.product_type || "",
            primaryKeyword: ctx.primaryKeyword,
            keywords: ctx.keywords,
            searchPhrase: ctx.searchPhrase,
            attributes: ctx.attributes,
            smartListing,
        };
    } catch (smartErr) {
        console.warn("[smart-image-search] Smart listing failed:", smartErr.message);
        return null;
    }
};

const searchByVisionContext = async ({
    vision,
    pageLimit,
    skip,
    category,
    fieldName,
    fieldValue,
    country,
} = {}) => {
    const items = [];
    if (!vision) return items;

    const primaryKeyword = vision.primaryKeyword || vision.searchPhrase || vision.objectLabel || "";
    const keywords = vision.keywords || [];
    const searchPhrase = vision.searchPhrase || primaryKeyword;

    if (!primaryKeyword && !searchPhrase) return items;

    try {
        const catalogItems = await searchCatalogByKeywords({
            primaryKeyword: primaryKeyword || searchPhrase,
            keywords,
            limit: pageLimit,
            skip,
            category,
            fieldName,
            fieldValue,
        });
        mergeItems(items, await resolveActiveCatalogItems(catalogItems), { scoreBoost: 4 });
    } catch (catalogErr) {
        console.warn("[smart-image-search] Catalog keyword search failed:", catalogErr.message);
    }

    try {
        const alibabaItems = await searchAlibabaCatalogByKeywords({
            primaryKeyword: primaryKeyword || searchPhrase,
            keywords,
            pageLimit,
            pageSkip: skip,
            country,
        });
        mergeItems(items, alibabaItems, { scoreBoost: 3 });
    } catch (alibabaErr) {
        console.warn("[smart-image-search] 1688 keyword search failed:", alibabaErr.message);
    }

    if (searchPhrase) {
        try {
            const embedItems = await searchSimilarByEmbedding(searchPhrase, {
                limit: pageLimit,
                excludeIds: items.map((i) => i._id),
            });
            mergeItems(items, await resolveActiveCatalogItems(embedItems), { scoreBoost: 5 });
        } catch (embedErr) {
            console.warn("[smart-image-search] Embedding search failed:", embedErr.message);
        }

        try {
            const phraseItems = await searchCatalogByEmbeddingPhrase(searchPhrase, { limit: pageLimit });
            mergeItems(items, await resolveActiveCatalogItems(phraseItems), { scoreBoost: 3 });
        } catch (phraseErr) {
            console.warn("[smart-image-search] Phrase embedding failed:", phraseErr.message);
        }
    }

    return items;
};

/**
 * Full smart image search for uploaded/URL images (including photos not on the platform).
 */
const resolveSmartImageSearch = async ({
    imageUrl,
    limit = 24,
    skip = 1,
    category,
    fieldName,
    fieldValue,
    country = "en",
} = {}) => {
    const pageLimit = Math.max(1, Math.min(Number(limit) || 24, 48));
    let items = [];
    let smartListing = null;
    let provider = "pipeline";

    const visionResult = await resolveVisionFromImage(imageUrl);
    let vision = visionResult ? { ...visionResult } : null;
    if (visionResult?.smartListing) {
        smartListing = visionResult.smartListing;
        delete vision.smartListing;
    }
    if (vision?.primaryKeyword || vision?.searchPhrase) {
        provider = vision.provider || "ai-vision";
        mergeItems(items, await searchByVisionContext({
            vision,
            pageLimit,
            skip,
            category,
            fieldName,
            fieldValue,
            country,
        }));
    }

    try {
        const alibabaVisual = await runAlibabaImageSearch({
            imageUrl,
            pageLimit,
            pageSkip: skip,
            country,
        });
        if (alibabaVisual?.items?.length) {
            mergeItems(items, alibabaVisual.items, { scoreBoost: 2 });
            if (!vision?.primaryKeyword && alibabaVisual.vision) {
                vision = { ...vision, ...alibabaVisual.vision };
            }
            provider = items.length ? `${provider}+alibaba` : "alibaba";
        }
    } catch (alibabaVisualErr) {
        console.warn("[smart-image-search] 1688 imageQuery failed:", alibabaVisualErr.message);
    }

    let pipelineTotal = 0;
    if (items.length < pageLimit) {
        const pipeline = await runImageSearchPipeline({
            imageUrl,
            limit: pageLimit,
            skip,
            category,
            fieldName,
            fieldValue,
            country,
            skipGoogle: true,
        });

        if (!vision?.primaryKeyword && pipeline.vision?.primaryKeyword) {
            vision = pipeline.vision;
        }

        const before = items.length;
        mergeItems(items, pipeline.items || [], { scoreBoost: 1 });
        pipelineTotal = pipeline.total || 0;
        if (pipeline.provider && pipeline.provider !== "none") {
            provider = before > 0 ? `${provider}+${pipeline.provider}` : pipeline.provider;
        }
    }

    // Rank by match_score then similarity_score
    items.sort((a, b) => {
        const scoreA = Number(a.match_score || a.similarity_score || 0);
        const scoreB = Number(b.match_score || b.similarity_score || 0);
        return scoreB - scoreA;
    });

    items = items.slice(0, pageLimit);
    const recommendations = await collectRecommendations(
        items,
        vision?.searchPhrase || vision?.primaryKeyword || "",
        { limit: 12 }
    );

    return {
        items,
        recommendations,
        smartListing,
        vision,
        provider,
        total: items.length ? Math.max(items.length, pipelineTotal) : 0,
    };
};

/**
 * Text search recommendations using query embedding + similar products.
 */
const resolveSearchRecommendations = async (searchQuery, mainItems = [], { limit = 8 } = {}) => {
    const query = String(searchQuery || "").trim();
    if (!query) return [];

    const recommendations = await collectRecommendations(mainItems, query, { limit });

    if (recommendations.length < limit && isDashscopeConfigured()) {
        const embedRecs = await searchSimilarByEmbedding(query, {
            limit: limit - recommendations.length,
            excludeIds: [...mainItems.map((i) => i._id), ...recommendations.map((r) => r._id)],
        });
        mergeItems(recommendations, embedRecs);
    }

    const mainKeys = new Set(mainItems.map(itemKey));
    return recommendations.filter((item) => !mainKeys.has(itemKey(item))).slice(0, limit);
};

module.exports = {
    isSmartImageSearchEnabled,
    resolveSmartImageSearch,
    resolveSearchRecommendations,
    searchSimilarByEmbedding,
    buildSmartListingSearchContext,
};
