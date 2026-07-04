const { chatCompletionWithFallback } = require("../ai/services/chatWithFallback");
const { redisMGet, redisMSet } = require("./redisCache");
const {
    applyGlossaryToFields,
    shouldTranslateFieldForLang,
} = require("./attributeGlossary");

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
const translateAttributeEntriesToFrench = async (entries = {}) => {
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
                    "You are a professional French translator for B2B wholesale product specifications (1688 / Alibaba style). "
                    + "Translate each JSON value to natural French for product attribute labels and values. "
                    + "Keep JSON keys unchanged. Preserve numbers, sizes (39, 40, 2kg), SKUs, brand codes (0001, sgs), "
                    + "and platform names (eBay, Amazon) when they are identifiers. "
                    + "Return ONLY valid JSON with the same keys.",
            },
            {
                role: "user",
                content: `Translate these product specification strings to French:\n${payload}`,
            },
        ],
    });

    const raw = String(content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Attribute translation model did not return valid JSON");
    }
    return JSON.parse(jsonMatch[0]);
};

const translateAttributeEntriesToEnglish = async (entries = {}) => {
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
                    "You are a professional English translator for B2B wholesale product specifications (1688 / Alibaba style). "
                    + "Translate each JSON value from Chinese (or mixed Chinese/English) to clear natural English for product attribute labels and values. "
                    + "Keep JSON keys unchanged. Preserve numbers, sizes (39, 40, 2kg), SKUs, brand codes, "
                    + "and platform names (eBay, Amazon) when they are identifiers. "
                    + "Return ONLY valid JSON with the same keys.",
            },
            {
                role: "user",
                content: `Translate these product specification strings to English:\n${payload}`,
            },
        ],
    });

    const raw = String(content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Attribute translation model did not return valid JSON");
    }
    return JSON.parse(jsonMatch[0]);
};

const translateEntriesToFrench = async (entries = {}) => {
    const keys = Object.keys(entries);
    if (!keys.length) return {};

    const attributeLike = keys.every((key) => /^(txt_[lv]_|fa_[nv]_|var_[at]_)/.test(key));
    if (attributeLike) {
        return translateAttributeEntriesToFrench(entries);
    }

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

const translateEntriesToEnglish = async (entries = {}) => {
    const keys = Object.keys(entries);
    if (!keys.length) return {};

    const attributeLike = keys.every((key) => /^(txt_[lv]_|fa_[nv]_|var_[at]_)/.test(key));
    if (attributeLike) {
        return translateAttributeEntriesToEnglish(entries);
    }

    const payload = JSON.stringify(entries, null, 2);
    const { content } = await chatCompletionWithFallback({
        model: TRANSLATION_MODEL(),
        temperature: 0.1,
        messages: [
            {
                role: "system",
                content:
                    "You are a professional English translator for an e-commerce wholesale website (UZABULK). "
                    + "Translate each JSON value from Chinese to natural English. Keep JSON keys unchanged. "
                    + "Preserve placeholders like {{name}}, HTML tags, and brand names (UZABULK, UZA). "
                    + "Return ONLY valid JSON with the same keys.",
            },
            {
                role: "user",
                content: `Translate these UI strings to English:\n${payload}`,
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

const translateEntriesForLang = async (entries = {}, targetLang = "fr") => {
    if (targetLang === "en") return translateEntriesToEnglish(entries);
    return translateEntriesToFrench(entries);
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
    const pairs = [];
    Object.entries(translations).forEach(([id, value]) => {
        const translated = String(value || "").trim();
        if (!id || !translated) return;
        if (productNameCache.size >= PRODUCT_NAME_CACHE_MAX) {
            const firstKey = productNameCache.keys().next().value;
            productNameCache.delete(firstKey);
        }
        productNameCache.set(`fr:${id}`, translated);
        pairs.push([`uzabulk:trans:fr:name:${id}`, translated]);
    });
    if (pairs.length) redisMSet(pairs).catch(() => {});
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

    // Check Redis for uncached items
    const redisKeys = toTranslate.map((item) => `uzabulk:trans:fr:name:${item.id}`);
    const redisValues = await redisMGet(redisKeys);
    const stillToTranslate = [];
    toTranslate.forEach((item, idx) => {
        if (redisValues[idx]) {
            result[item.id] = redisValues[idx];
            productNameCache.set(`fr:${item.id}`, redisValues[idx]);
        } else {
            stillToTranslate.push(item);
        }
    });
    if (!stillToTranslate.length) return result;
    const toTranslateFiltered = stillToTranslate;
    // reassign for rest of function
    toTranslate.length = 0;
    toTranslateFiltered.forEach(i => toTranslate.push(i));

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

const detailFieldCache = new Map();
const DETAIL_FIELD_CACHE_MAX = 8000;
const MAX_DESCRIPTION_CHARS = 15000;
const MAX_DETAIL_TEXT_FIELD = 2000;

const cacheDetailFields = (productId, translations = {}, targetLang = "fr") => {
    const pid = String(productId || "").trim();
    const lang = targetLang === "en" ? "en" : "fr";
    if (!pid) return;
    Object.entries(translations).forEach(([key, value]) => {
        const translated = String(value || "").trim();
        if (!key || !translated) return;
        const cacheKey = `${lang}:detail:${pid}:${key}`;
        if (detailFieldCache.size >= DETAIL_FIELD_CACHE_MAX) {
            const firstKey = detailFieldCache.keys().next().value;
            detailFieldCache.delete(firstKey);
        }
        detailFieldCache.set(cacheKey, translated);
    });
};

const getCachedDetailFields = (productId, fields = {}, targetLang = "fr") => {
    const pid = String(productId || "").trim();
    const lang = targetLang === "en" ? "en" : "fr";
    const result = {};
    const pending = {};
    Object.entries(fields).forEach(([key, value]) => {
        const source = String(value || "").trim();
        if (!source) return;
        const cacheKey = `${lang}:detail:${pid}:${key}`;
        if (detailFieldCache.has(cacheKey)) {
            result[key] = detailFieldCache.get(cacheKey);
        } else {
            pending[key] = source;
        }
    });
    return { result, pending };
};

const translateHtmlDescriptionForLang = async (html = "", targetLang = "fr") => {
    const input = String(html || "").trim().slice(0, MAX_DESCRIPTION_CHARS);
    if (!input) return "";

    const langLabel = targetLang === "en" ? "English" : "French";
    const { content } = await chatCompletionWithFallback({
        model: TRANSLATION_MODEL(),
        temperature: 0.1,
        messages: [
            {
                role: "system",
                content:
                    `Translate this e-commerce product description HTML to ${langLabel} for UZABULK (B2B wholesale). `
                    + "Preserve all HTML tags, attributes, image URLs, and document structure. "
                    + "Only translate human-readable text. Return only the translated HTML fragment.",
            },
            { role: "user", content: input },
        ],
    });
    return String(content || "").trim();
};

/**
 * Translate product detail text fields (description, attributes, variation labels).
 * @param {string} productId
 * @param {Record<string, string>} fields
 * @param {"en"|"fr"} targetLang
 */
const translateProductDetailFields = async (productId, fields = {}, targetLang = "fr") => {
    const pid = String(productId || "").trim();
    const lang = targetLang === "en" ? "en" : "fr";
    if (!pid) return {};

    const normalized = {};
    Object.entries(fields || {}).forEach(([key, value]) => {
        const text = String(value || "").trim();
        if (!text) return;
        if (key === "description") {
            normalized[key] = text.slice(0, MAX_DESCRIPTION_CHARS);
        } else {
            normalized[key] = text.slice(0, MAX_DETAIL_TEXT_FIELD);
        }
    });

    if (!Object.keys(normalized).length) return {};

    const { result, pending } = getCachedDetailFields(pid, normalized, lang);
    if (!Object.keys(pending).length) {
        return lang === "fr"
            ? { ...result, ...applyGlossaryToFields(normalized) }
            : result;
    }

    const glossaryHits = lang === "fr" ? applyGlossaryToFields(pending) : {};
    const stillPending = {};
    Object.entries(pending).forEach(([key, value]) => {
        if (glossaryHits[key]) return;
        const kind = key.startsWith("txt_v_") || key.startsWith("fa_v_") || key.startsWith("var_t_")
            ? "value"
            : "label";
        if (!shouldTranslateFieldForLang(value, lang, kind)) return;
        stillPending[key] = value;
    });

    const translated = { ...result, ...glossaryHits };
    cacheDetailFields(pid, glossaryHits, lang);

    const { description, ...rest } = stillPending;

    if (Object.keys(rest).length) {
        const entries = Object.entries(rest);
        const CHUNK_SIZE = 40;
        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
            const chunk = Object.fromEntries(entries.slice(i, i + CHUNK_SIZE));
            const translatedChunk = await translateEntriesForLang(chunk, lang);
            Object.assign(translated, translatedChunk);
            cacheDetailFields(pid, translatedChunk, lang);
        }
    }

    if (description) {
        try {
            translated.description = await translateHtmlDescriptionForLang(description, lang);
            cacheDetailFields(pid, { description: translated.description }, lang);
        } catch (error) {
            console.warn("translateProductDetailFields description:", error?.message || error);
        }
    }

    return translated;
};

const translateProductDetailFieldsToFrench = async (productId, fields = {}, targetLang = "fr") =>
    translateProductDetailFields(productId, fields, targetLang);

module.exports = {
    translateEntriesToFrench,
    translateTextToFrench,
    translateProductNamesToFrench,
    translateProductDetailFieldsToFrench,
};
