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

const toStringList = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry || "").trim()).filter(Boolean);
    }
    const single = String(value || "").trim();
    return single ? [single] : [];
};

const FEATURE_SCAN_PROMPT = [
    "You are a product image feature scanner for B2B wholesale catalog matching.",
    "Scan the ENTIRE image carefully. Identify the main product AND every visible feature that would help find the same or highly similar products.",
    "Do not invent features you cannot see. Be specific and concrete (wholesale listing language).",
    "Return JSON only (no markdown):",
    "{",
    '  "object_label": string,',
    '  "primaryKeyword": string,',
    '  "keywords": string[],',
    '  "search_phrase": string,',
    '  "category": string,',
    '  "product_type": string,',
    '  "colors": string[],',
    '  "materials": string[],',
    '  "shape": string,',
    '  "pattern": string,',
    '  "style": string,',
    '  "brand_or_logo": string,',
    '  "finish": string,',
    '  "size_hint": string,',
    '  "parts_and_components": string[],',
    '  "distinctive_features": string[],',
    '  "visible_text": string,',
    '  "use_case": string,',
    '  "accessories_included": string[],',
    '  "packaging": string,',
    '  "condition": string',
    "}",
    "Rules:",
    "- object_label = clear English name of the main product (e.g. 'black leather ankle boots').",
    "- primaryKeyword = best short wholesale search term (2-5 words).",
    "- keywords = up to 16 search terms built from visible features: type, colors, materials, style, pattern, use-case, brand, distinctive details.",
    "- search_phrase = one natural language phrase packing the most important visible features for semantic product matching.",
    "- colors / materials = every clearly visible color and material (arrays).",
    "- shape / pattern / style / finish / size_hint = only what is visible.",
    "- parts_and_components = visible parts (zippers, straps, buttons, screens, lenses, handles, etc.).",
    "- distinctive_features = unique visual details that distinguish this item from similar products.",
    "- visible_text = any readable text/logo/label on the product or packaging.",
    "- accessories_included / packaging = only if clearly present in the image.",
    "- Prefer feature-rich, matchable terms over vague words like 'product' or 'item'.",
].join("\n");

/**
 * DashScope VL — scan every visible product feature, then derive catalog search terms.
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
                    text: FEATURE_SCAN_PROMPT,
                },
            ],
        }],
        temperature: 0.15,
    });

    const parsed = parseJsonFromLlm(response.choices?.[0]?.message?.content || "");
    const colors = toStringList(parsed?.colors?.length ? parsed.colors : parsed?.color);
    const materials = toStringList(parsed?.materials?.length ? parsed.materials : parsed?.material);
    const parts = toStringList(parsed?.parts_and_components);
    const distinctive = toStringList(parsed?.distinctive_features);
    const accessories = toStringList(parsed?.accessories_included);

    const keywords = [];
    const seen = new Set();
    appendKeyword(keywords, seen, parsed?.object_label);
    appendKeyword(keywords, seen, parsed?.primaryKeyword);
    appendKeyword(keywords, seen, parsed?.search_phrase);
    appendKeyword(keywords, seen, parsed?.product_type);
    appendKeyword(keywords, seen, parsed?.category);
    appendKeyword(keywords, seen, parsed?.shape);
    appendKeyword(keywords, seen, parsed?.pattern);
    appendKeyword(keywords, seen, parsed?.style);
    appendKeyword(keywords, seen, parsed?.brand_or_logo);
    appendKeyword(keywords, seen, parsed?.finish);
    appendKeyword(keywords, seen, parsed?.size_hint);
    appendKeyword(keywords, seen, parsed?.use_case);
    appendKeyword(keywords, seen, parsed?.visible_text);
    appendKeyword(keywords, seen, parsed?.packaging);
    colors.forEach((k) => appendKeyword(keywords, seen, k));
    materials.forEach((k) => appendKeyword(keywords, seen, k));
    parts.forEach((k) => appendKeyword(keywords, seen, k));
    distinctive.forEach((k) => appendKeyword(keywords, seen, k));
    accessories.forEach((k) => appendKeyword(keywords, seen, k));
    (Array.isArray(parsed?.keywords) ? parsed.keywords : []).forEach((k) => appendKeyword(keywords, seen, k));

    // Compound feature needles: "red leather", "wireless earbuds", etc.
    const color = colors[0] || "";
    const material = materials[0] || "";
    const productType = String(parsed?.product_type || "").trim();
    if (color && productType) appendKeyword(keywords, seen, `${color} ${productType}`);
    if (material && productType) appendKeyword(keywords, seen, `${material} ${productType}`);
    if (color && material) appendKeyword(keywords, seen, `${color} ${material}`);
    if (parsed?.style && productType) appendKeyword(keywords, seen, `${parsed.style} ${productType}`);
    if (parsed?.pattern && productType) appendKeyword(keywords, seen, `${parsed.pattern} ${productType}`);
    if (parsed?.brand_or_logo && productType) {
        appendKeyword(keywords, seen, `${parsed.brand_or_logo} ${productType}`);
    }

    const primaryKeyword = normalizeKeyword(parsed?.primaryKeyword)
        || normalizeKeyword(parsed?.object_label)
        || normalizeKeyword(parsed?.search_phrase)
        || keywords[0];
    if (!primaryKeyword) return null;

    const featureSummary = [
        parsed?.object_label,
        colors.length ? `colors: ${colors.join(", ")}` : "",
        materials.length ? `materials: ${materials.join(", ")}` : "",
        parsed?.shape ? `shape: ${parsed.shape}` : "",
        parsed?.pattern ? `pattern: ${parsed.pattern}` : "",
        parsed?.style ? `style: ${parsed.style}` : "",
        distinctive.length ? `features: ${distinctive.slice(0, 6).join(", ")}` : "",
        parts.length ? `parts: ${parts.slice(0, 6).join(", ")}` : "",
        parsed?.visible_text ? `text: ${parsed.visible_text}` : "",
        parsed?.use_case ? `use: ${parsed.use_case}` : "",
    ].filter(Boolean).join("; ");

    return {
        provider: "dashscope",
        objectLabel: String(parsed?.object_label || parsed?.product_type || primaryKeyword || "").trim(),
        primaryKeyword,
        keywords: keywords.slice(0, 20),
        searchPhrase: normalizeKeyword(parsed?.search_phrase) || primaryKeyword,
        featureSummary,
        attributes: {
            category: parsed?.category || "",
            product_type: productType,
            color: color || colors.join(", "),
            colors,
            material: material || materials.join(", "),
            materials,
            shape: String(parsed?.shape || "").trim(),
            pattern: String(parsed?.pattern || "").trim(),
            style: String(parsed?.style || "").trim(),
            brand_or_logo: String(parsed?.brand_or_logo || "").trim(),
            finish: String(parsed?.finish || "").trim(),
            size_hint: String(parsed?.size_hint || "").trim(),
            parts_and_components: parts,
            distinctive_features: distinctive,
            visible_text: String(parsed?.visible_text || "").trim(),
            use_case: String(parsed?.use_case || "").trim(),
            accessories_included: accessories,
            packaging: String(parsed?.packaging || "").trim(),
            condition: String(parsed?.condition || "").trim(),
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
        categoryHint: vision?.attributes?.category || "",
        attributes: vision?.attributes || {},
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
