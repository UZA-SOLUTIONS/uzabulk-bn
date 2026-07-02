const { isDashscopeConfigured } = require("../dashscopeClient");
const { getDashscopeClient } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { getVisionModel } = require("../helpers/resolveChatModel");
const { resolveVisionImageInput } = require("../helpers/resolveVisionImageInput");
const { getEmbedding } = require("./embeddingService");
const { searchProductsByVector } = require("../../products/services/vectorSearchService");

const getSearchCatalogByText = () =>
    require("../../products/services/catalogSearchService").searchCatalogByText;

const getSearchCatalogForImage = () =>
    require("../../products/services/catalogSearchService").searchCatalogForImage;

const getBuildImageSearchCatalogNeedles = () =>
    require("../../products/services/catalogSearchService").buildImageSearchCatalogNeedles;

const isAiImageSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const dashscope = (typeof env !== "undefined" ? env : global.env || {})?.dashscope || {};
    const flag = String(dashscope.AI_IMAGE_SEARCH ?? dashscope.AI_SEARCH ?? "true").toLowerCase();
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
                        "Use concrete wholesale listing language (material, product type, use-case) — not vague retail terms.",
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

    const primaryKeyword = normalizeKeyword(parsed?.primaryKeyword)
        || normalizeKeyword(parsed?.object_label)
        || normalizeKeyword(parsed?.search_phrase)
        || keywords[0];
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

const searchCatalogByKeywords = async ({
    primaryKeyword,
    keywords = [],
    limit = 32,
    skip = 1,
    category,
    fieldName,
    fieldValue,
    fast = false,
    vision = null,
} = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 32, 100));

    const uniqueKeywords = [...new Set(
        [primaryKeyword, ...(Array.isArray(keywords) ? keywords : [])]
            .map((term) => String(term || "").trim())
            .filter((term) => term.length >= 2)
    )];

    const catalogNeedles = getBuildImageSearchCatalogNeedles()({
        primaryKeyword,
        searchPhrase: vision?.searchPhrase || "",
        objectLabel: vision?.objectLabel || "",
        keywords: uniqueKeywords,
    });

    if (!catalogNeedles.length && !primaryKeyword) return [];

    try {
        const result = await getSearchCatalogForImage()({
            search: primaryKeyword,
            limit: cap,
            skip,
            category,
            fieldName,
            fieldValue,
            vision,
        });
        return result?.items || [];
    } catch (error) {
        console.warn("Image catalog keyword search failed:", error?.message || error);
        return [];
    }
};

const searchCatalogByEmbeddingPhrase = async (phrase, { limit = 32 } = {}) => {
    const text = String(phrase || "").trim();
    if (!text || !isDashscopeConfigured()) return [];

    const cap = Math.max(1, Math.min(Number(limit) || 32, 48));
    const queryVector = await getEmbedding(text.slice(0, 2000));

    return searchProductsByVector(queryVector, {}, {
        limit: cap,
        minScore: 0.15,
        candidateLimit: 120,
    });
};

/**
 * Full AI image search: VL keywords + Elasticsearch catalog (+ embedding fallback).
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
            vision,
        });
    } catch (keywordError) {
        console.warn("AI keyword image search failed:", keywordError?.message || keywordError);
    }

    if (items.length < 3 && vision.searchPhrase) {
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
