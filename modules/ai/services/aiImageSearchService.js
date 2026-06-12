const Product = require("../../../models/productsTable");
const { isDashscopeConfigured } = require("../dashscopeClient");
const { getDashscopeClient } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { getVisionModel } = require("../helpers/resolveChatModel");
const { resolveVisionImageInput } = require("../helpers/resolveVisionImageInput");
const {
    getEmbedding,
    cosineSimilarity,
} = require("./embeddingService");
const esProductService = require("../../products/services/esProductService");
const { attachProductRatingsFromStored } = require("../../products/helper/ratings");

const isAiImageSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(env?.dashscope?.AI_IMAGE_SEARCH ?? env?.dashscope?.AI_SEARCH ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const normalizeKeyword = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const appendKeyword = (output, seen, keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
};

/**
 * DashScope VL — extract catalog search keywords from a product image URL.
 */
const extractImageSearchKeywords = async (imageAddress) => {
    const url = String(imageAddress || "").trim();
    if (!url) throw new Error("imageAddress is required");
    if (!isAiImageSearchEnabled()) return null;

    const visionImage = await resolveVisionImageInput(url);
    const client = getDashscopeClient();
    const response = await client.chat.completions.create({
        model: getVisionModel(),
        messages: [{
            role: "user",
            content: [
                visionImage,
                {
                    type: "text",
                    text: [
                        "You analyze ANY product photo for B2B wholesale search — the item may NOT be in our catalog.",
                        "Identify the main object, name it clearly, and suggest how to find similar wholesale products.",
                        "Return JSON only (no markdown):",
                        "{",
                        '  "object_label": string,',
                        '  "primaryKeyword": string,',
                        '  "keywords": string[],',
                        '  "search_phrase": string,',
                        '  "category": string,',
                        '  "product_type": string,',
                        '  "color": string,',
                        '  "material": string',
                        "}",
                        "object_label = plain English name of what you see (e.g. 'blue running shoes').",
                        "primaryKeyword = best short wholesale search term (2-5 words).",
                        "keywords = up to 8 related terms: type, color, material, use-case, style.",
                        "search_phrase = one natural language phrase describing the product for semantic search.",
                    ].join("\n"),
                },
            ],
        }],
        temperature: 0.2,
    });

    const parsed = parseJsonFromLlm(response.choices?.[0]?.message?.content || "");
    const keywords = [];
    const seen = new Set();
    appendKeyword(keywords, seen, parsed?.object_label);
    appendKeyword(keywords, seen, parsed?.primaryKeyword);
    appendKeyword(keywords, seen, parsed?.search_phrase);
    appendKeyword(keywords, seen, parsed?.product_type);
    appendKeyword(keywords, seen, parsed?.category);
    appendKeyword(keywords, seen, parsed?.color);
    appendKeyword(keywords, seen, parsed?.material);
    (Array.isArray(parsed?.keywords) ? parsed.keywords : []).forEach((k) => appendKeyword(keywords, seen, k));

    const primaryKeyword = keywords[0] || normalizeKeyword(parsed?.search_phrase);
    if (!primaryKeyword) return null;

    return {
        provider: "dashscope",
        objectLabel: String(parsed?.object_label || parsed?.product_type || primaryKeyword || "").trim(),
        primaryKeyword,
        keywords,
        searchPhrase: normalizeKeyword(parsed?.search_phrase) || primaryKeyword,
        attributes: {
            category: parsed?.category || "",
            product_type: parsed?.product_type || "",
            color: parsed?.color || "",
            material: parsed?.material || "",
            object_label: String(parsed?.object_label || "").trim(),
        },
    };
};

const unwrapEsSearchResult = (result) => {
    if (Array.isArray(result)) return { items: result, total: 0 };
    return { items: result?.items || [], total: typeof result?.total === "number" ? result.total : 0 };
};

const searchCatalogByKeywords = async ({
    primaryKeyword,
    keywords = [],
    limit = 32,
    skip = 1,
    category,
    fieldName,
    fieldValue,
} = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 32, 100));
    const baseQuery = { category, fieldName, fieldValue, limit: cap, skip };

    let merged = [];
    const seen = new Set();

    const runTerm = async (term) => {
        if (!term) return;
        try {
            const { items } = unwrapEsSearchResult(
                await esProductService.list({
                    ...baseQuery,
                    search: term,
                    orderBy: "relevance",
                    order: -1,
                })
            );
            items.forEach((item) => {
                const key = String(item?._id || item?.offerId || "");
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            });
        } catch (error) {
            console.warn(`Image keyword search failed for "${term}":`, error?.message || error);
        }
    };

    await runTerm(primaryKeyword);
    for (const term of keywords.slice(0, 6)) {
        if (merged.length >= cap) break;
        if (term === primaryKeyword) continue;
        await runTerm(term);
    }

    if (!merged.length && primaryKeyword) {
        const mongoItems = await Product.find({
            status: "active",
            $or: [
                { name: { $regex: primaryKeyword, $options: "i" } },
                { short_description: { $regex: primaryKeyword, $options: "i" } },
            ],
        })
            .select("name price compare_price images featured_image average_rating rating_count short_description categories offerId slug")
            .populate({ path: "featured_image", select: "link -_id" })
            .limit(cap)
            .lean();
        merged = mongoItems;
    }

    return merged.slice(0, cap);
};

const searchCatalogByEmbeddingPhrase = async (phrase, { limit = 32 } = {}) => {
    const text = String(phrase || "").trim();
    if (!text || !isDashscopeConfigured()) return [];

    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
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
            item: attachProductRatingsFromStored({ ...item }),
            score: cosineSimilarity(queryVector, item.embedding),
        }))
        .filter((row) => row.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, cap)
        .map((row) => row.item);
};

/**
 * Full AI image search: VL keywords + ES + embedding fallback.
 */
const resolveImageSearchFromAi = async ({
    imageAddress,
    limit = 32,
    skip = 1,
    category,
    fieldName,
    fieldValue,
} = {}) => {
    if (!isAiImageSearchEnabled()) return null;

    const vision = await extractImageSearchKeywords(imageAddress);
    if (!vision?.primaryKeyword) return null;

    let items = [];
    try {
        items = await searchCatalogByKeywords({
            primaryKeyword: vision.primaryKeyword,
            keywords: vision.keywords,
            limit,
            skip,
            category,
            fieldName,
            fieldValue,
        });
    } catch (keywordError) {
        console.warn("AI keyword image search failed:", keywordError?.message || keywordError);
    }

    if (vision.searchPhrase) {
        try {
            const embedded = await searchCatalogByEmbeddingPhrase(vision.searchPhrase, { limit });
            const seen = new Set(items.map((i) => String(i?._id || i?.offerId || "")));
            embedded.forEach((item) => {
                const key = String(item?._id || item?.offerId || "");
                if (!key || seen.has(key)) return;
                seen.add(key);
                items.push(item);
            });
        } catch (embedError) {
            console.warn("AI embedding image search fallback failed:", embedError?.message || embedError);
        }
    }

    return {
        items: items.slice(0, limit),
        vision,
    };
};

module.exports = {
    isAiImageSearchEnabled,
    extractImageSearchKeywords,
    searchCatalogByKeywords,
    searchCatalogByEmbeddingPhrase,
    resolveImageSearchFromAi,
};
