const { chatCompletionWithFallback } = require("../ai/services/chatWithFallback");

const TRANSLATION_MODEL = () =>
    process.env.DASHSCOPE_TRANSLATION_MODEL
    || process.env.DASHSCOPE_FAST_MODEL
    || process.env.DASHSCOPE_ASSISTANT_MODEL
    || "qwen-turbo";

/**
 * Translate a batch of UI strings to French using DashScope.
 * @param {Record<string, string>} entries - key → English text
 * @returns {Promise<Record<string, string>>}
 */
const translateEntriesToFrench = async (entries = {}) => {
    const keys = Object.keys(entries);
    if (!keys.length) return {};

    const payload = JSON.stringify(entries, null, 2);
    const { content } = await chatCompletionWithFallback({
        model: TRANSLATION_MODEL(),
        temperature: 0.1,
        messages: [
            {
                role: "system",
                content:
                    "You are a professional French translator for an e-commerce wholesale website (UZABULK). "
                    + "Translate each JSON value to natural French. Keep JSON keys unchanged. "
                    + "Preserve placeholders like {{name}}, HTML tags, and brand names (UZABULK, UZA). "
                    + "Return ONLY valid JSON with the same keys.",
            },
            {
                role: "user",
                content: `Translate these UI strings to French:\n${payload}`,
            },
        ],
    });

    const raw = String(content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Translation model did not return valid JSON");
    }
    return JSON.parse(jsonMatch[0]);
};

/**
 * Translate arbitrary user-facing text to French (cached by caller if needed).
 */
const translateTextToFrench = async (text = "") => {
    const input = String(text || "").trim();
    if (!input) return "";

    const { content } = await chatCompletionWithFallback({
        model: TRANSLATION_MODEL(),
        temperature: 0.1,
        messages: [
            {
                role: "system",
                content: "Translate the following e-commerce UI text to French. Return only the translation.",
            },
            { role: "user", content: input },
        ],
    });
    return String(content || "").trim();
};

const productNameCache = new Map();
const PRODUCT_NAME_CACHE_MAX = 5000;

const cacheProductNames = (translations = {}) => {
    Object.entries(translations).forEach(([id, value]) => {
        const translated = String(value || "").trim();
        if (!id || !translated) return;
        if (productNameCache.size >= PRODUCT_NAME_CACHE_MAX) {
            const firstKey = productNameCache.keys().next().value;
            productNameCache.delete(firstKey);
        }
        productNameCache.set(`fr:${id}`, translated);
    });
};

/**
 * Batch-translate product titles to French (DashScope).
 * @param {Array<{ id: string, name: string }>} items
 * @returns {Promise<Record<string, string>>}
 */
const translateProductNamesToFrench = async (items = []) => {
    const normalized = (items || [])
        .map((item) => ({
            id: String(item?.id || "").trim(),
            name: String(item?.name || "").trim(),
        }))
        .filter((item) => item.id && item.name);

    if (!normalized.length) return {};

    const result = {};
    const toTranslate = [];

    normalized.forEach((item) => {
        const cacheKey = `fr:${item.id}`;
        if (productNameCache.has(cacheKey)) {
            result[item.id] = productNameCache.get(cacheKey);
        } else {
            toTranslate.push(item);
        }
    });

    if (!toTranslate.length) return result;

    const entries = {};
    toTranslate.forEach((item) => {
        entries[item.id] = item.name;
    });

    const payload = JSON.stringify(entries, null, 2);
    const { content } = await chatCompletionWithFallback({
        model: TRANSLATION_MODEL(),
        temperature: 0.1,
        messages: [
            {
                role: "system",
                content:
                    "You are a professional French translator for an e-commerce wholesale catalog (UZABULK). "
                    + "Translate each product title to natural French suitable for B2B buyers. "
                    + "Keep brand names, model numbers, SKUs, sizes, colors (when standard), and units unchanged. "
                    + "Do not add marketing fluff. Return ONLY valid JSON with the same keys.",
            },
            {
                role: "user",
                content: `Translate these product names to French:\n${payload}`,
            },
        ],
    });

    const raw = String(content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Product name translation did not return valid JSON");
    }

    const translated = JSON.parse(jsonMatch[0]);
    cacheProductNames(translated);
    return { ...result, ...translated };
};

module.exports = {
    translateEntriesToFrench,
    translateTextToFrench,
    translateProductNamesToFrench,
};
