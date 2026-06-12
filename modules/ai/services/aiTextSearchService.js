const { isDashscopeConfigured } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { chatCompletionWithFallback } = require("./chatWithFallback");

const isAiTextSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(env?.dashscope?.AI_TEXT_SEARCH ?? env?.dashscope?.AI_SEARCH ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();

const uniqueTerms = (terms = []) => {
    const seen = new Set();
    const out = [];
    terms.forEach((raw) => {
        const term = normalizeTerm(raw);
        if (!term || term.length < 2 || seen.has(term)) return;
        seen.add(term);
        out.push(term);
    });
    return out;
};

/** Most common wholesale meaning for short/ambiguous product words. */
const COMMON_PRODUCT_INTENTS = {
    bottle: {
        primary: "water bottle",
        keywords: ["water bottle", "plastic water bottle", "sports water bottle", "drinking bottle", "reusable water bottle"],
        productType: "water bottle",
        categoryHint: "drinkware",
    },
    bottles: {
        primary: "water bottle",
        keywords: ["water bottle", "plastic water bottle", "sports water bottle", "drinking bottle", "reusable water bottle"],
        productType: "water bottle",
        categoryHint: "drinkware",
    },
    cup: {
        primary: "drinking cup",
        keywords: ["plastic cup", "coffee cup", "paper cup", "disposable cup", "drinking cup"],
        productType: "drinking cup",
        categoryHint: "drinkware",
    },
    cups: {
        primary: "drinking cup",
        keywords: ["plastic cup", "coffee cup", "paper cup", "disposable cup", "drinking cup"],
        productType: "drinking cup",
        categoryHint: "drinkware",
    },
    bag: {
        primary: "tote bag",
        keywords: ["tote bag", "handbag", "shopping bag", "backpack", "shoulder bag"],
        productType: "tote bag",
        categoryHint: "bags",
    },
    bags: {
        primary: "tote bag",
        keywords: ["tote bag", "handbag", "shopping bag", "backpack", "shoulder bag"],
        productType: "tote bag",
        categoryHint: "bags",
    },
    pen: {
        primary: "ballpoint pen",
        keywords: ["ballpoint pen", "gel pen", "office pen", "writing pen"],
        productType: "ballpoint pen",
        categoryHint: "stationery",
    },
    pens: {
        primary: "ballpoint pen",
        keywords: ["ballpoint pen", "gel pen", "office pen", "writing pen"],
        productType: "ballpoint pen",
        categoryHint: "stationery",
    },
    chair: {
        primary: "office chair",
        keywords: ["office chair", "desk chair", "ergonomic chair", "gaming chair"],
        productType: "office chair",
        categoryHint: "furniture",
    },
    chairs: {
        primary: "office chair",
        keywords: ["office chair", "desk chair", "ergonomic chair", "gaming chair"],
        productType: "office chair",
        categoryHint: "furniture",
    },
    light: {
        primary: "led light",
        keywords: ["led light", "led bulb", "desk lamp", "ceiling light"],
        productType: "led light",
        categoryHint: "lighting",
    },
    lights: {
        primary: "led light",
        keywords: ["led light", "led bulb", "desk lamp", "ceiling light"],
        productType: "led light",
        categoryHint: "lighting",
    },
    shoe: {
        primary: "sneakers",
        keywords: ["sneakers", "running shoes", "casual shoes", "sports shoes"],
        productType: "sneakers",
        categoryHint: "footwear",
    },
    shoes: {
        primary: "sneakers",
        keywords: ["sneakers", "running shoes", "casual shoes", "sports shoes"],
        productType: "sneakers",
        categoryHint: "footwear",
    },
    watch: {
        primary: "smart watch",
        keywords: ["smart watch", "digital watch", "wrist watch", "fitness watch"],
        productType: "smart watch",
        categoryHint: "electronics",
    },
    watches: {
        primary: "smart watch",
        keywords: ["smart watch", "digital watch", "wrist watch", "fitness watch"],
        productType: "smart watch",
        categoryHint: "electronics",
    },
    phone: {
        primary: "mobile phone",
        keywords: ["mobile phone", "smartphone", "cell phone", "android phone"],
        productType: "mobile phone",
        categoryHint: "electronics",
    },
    phones: {
        primary: "mobile phone",
        keywords: ["mobile phone", "smartphone", "cell phone", "android phone"],
        productType: "mobile phone",
        categoryHint: "electronics",
    },
    shirt: {
        primary: "t-shirt",
        keywords: ["t-shirt", "polo shirt", "cotton shirt", "men shirt", "women shirt"],
        productType: "t-shirt",
        categoryHint: "apparel",
    },
    shirts: {
        primary: "t-shirt",
        keywords: ["t-shirt", "polo shirt", "cotton shirt", "men shirt", "women shirt"],
        productType: "t-shirt",
        categoryHint: "apparel",
    },
    mask: {
        primary: "face mask",
        keywords: ["face mask", "disposable mask", "kn95 mask", "surgical mask"],
        productType: "face mask",
        categoryHint: "health",
    },
    masks: {
        primary: "face mask",
        keywords: ["face mask", "disposable mask", "kn95 mask", "surgical mask"],
        productType: "face mask",
        categoryHint: "health",
    },
    glass: {
        primary: "drinking glass",
        keywords: ["drinking glass", "wine glass", "glass cup", "glassware"],
        productType: "drinking glass",
        categoryHint: "drinkware",
    },
    glasses: {
        primary: "eyeglasses",
        keywords: ["eyeglasses", "sunglasses", "reading glasses", "optical glasses", "safety glasses"],
        productType: "eyeglasses",
        categoryHint: "eyewear",
    },
    glasse: {
        primary: "eyeglasses",
        keywords: ["eyeglasses", "sunglasses", "reading glasses", "optical glasses"],
        productType: "eyeglasses",
        categoryHint: "eyewear",
    },
};

const inferCommonProductIntent = (search = "") => {
    const original = normalizeTerm(search);
    if (!original || original.includes(" ")) return null;
    const intent = COMMON_PRODUCT_INTENTS[original];
    if (!intent) return null;

    return {
        original,
        correctedQuery: intent.primary,
        primary: intent.primary,
        keywords: uniqueTerms([intent.primary, ...intent.keywords, original]),
        productType: intent.productType || intent.primary,
        categoryHint: intent.categoryHint || "",
        userIntent: "",
        exactPhrase: intent.primary,
        aiExpanded: false,
    };
};

const basicQueryCleanup = (search = "") => {
    const original = normalizeTerm(search);
    if (!original) {
        return {
            original: "",
            correctedQuery: "",
            primary: "",
            keywords: [],
            productType: "",
            categoryHint: "",
            userIntent: "",
            exactPhrase: "",
            aiExpanded: false,
        };
    }

    let corrected = original
        .replace(/\bt\s*shirt\b/g, "t-shirt")
        .replace(/\bcell\s*phone\b/g, "mobile phone")
        .replace(/\bhead\s*phones?\b/g, "headphones")
        .replace(/\blap\s*top\b/g, "laptop");

    const commonIntent = inferCommonProductIntent(corrected);
    if (commonIntent) return commonIntent;

    return {
        original,
        correctedQuery: corrected,
        primary: corrected,
        keywords: uniqueTerms([corrected, original]),
        productType: "",
        categoryHint: "",
        userIntent: "",
        exactPhrase: corrected,
        aiExpanded: false,
    };
};

const QUERY_CACHE = new Map();
const QUERY_CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_CACHE_MAX = 250;

const getCachedQuery = (key) => {
    const entry = QUERY_CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > QUERY_CACHE_TTL_MS) {
        QUERY_CACHE.delete(key);
        return null;
    }
    return entry.value;
};

const setCachedQuery = (key, value) => {
    QUERY_CACHE.set(key, { value, ts: Date.now() });
    while (QUERY_CACHE.size > QUERY_CACHE_MAX) {
        const oldest = QUERY_CACHE.keys().next().value;
        QUERY_CACHE.delete(oldest);
    }
};

const shouldSkipLlmExpansion = (baseline = {}) => {
    if (!baseline.original) return true;
    if (baseline.productType) return true;
    const words = baseline.original.split(" ").filter((part) => part.length > 1);
    return words.length >= 3;
};

const buildContextHints = (context = {}) => {
    const lines = [];
    if (Array.isArray(context.popularSearches) && context.popularSearches.length) {
        lines.push(`Popular searches on store: ${context.popularSearches.slice(0, 5).join(", ")}`);
    }
    if (Array.isArray(context.recentSearches) && context.recentSearches.length) {
        lines.push(`This shopper recently searched: ${context.recentSearches.slice(0, 5).join(", ")}`);
    }
    if (Array.isArray(context.recentInterpretations) && context.recentInterpretations.length) {
        lines.push(`Past interpreted intents: ${context.recentInterpretations.slice(0, 5).join(", ")}`);
    }
    return lines;
};

/**
 * AI interprets shopper text: fix typos, infer intent, emit catalog + ES search terms.
 */
const expandSearchQuery = async (search = "", context = {}, { fast = false } = {}) => {
    const baseline = basicQueryCleanup(search);
    if (!baseline.original) return baseline;

    const cacheKey = `${baseline.original}::${fast ? "fast" : "full"}`;
    const cached = getCachedQuery(cacheKey);
    if (cached) return cached;

    if (fast || !isAiTextSearchEnabled() || shouldSkipLlmExpansion(baseline)) {
        setCachedQuery(cacheKey, baseline);
        return baseline;
    }

    try {
        const contextLines = buildContextHints(context);
        const llmPromise = chatCompletionWithFallback({
            messages: [{
                role: "user",
                content: [
                    "You help B2B wholesale buyers search UZA Bulk (1688-sourced catalog).",
                    `User typed: "${baseline.original}"`,
                    ...(contextLines.length ? ["", ...contextLines] : []),
                    "Understand what product they want. Fix spelling/typos. Output search terms for Elasticsearch.",
                    "For ambiguous short queries, assume the MOST COMMONLY WHOLESALED variant.",
                    "Examples: bottles -> water bottles; cups -> drinking cups; bags -> tote/handbags;",
                    "lights -> LED lights; chairs -> office chairs; watches -> smart watches.",
                    "Use shopper history only when it clearly matches the same intent.",
                    "Put the preferred/common subtype first in primary, exact_phrase, and keywords.",
                    "Return JSON only (no markdown):",
                    "{",
                    '  "corrected_query": string,',
                    '  "primary": string,',
                    '  "keywords": string[],',
                    '  "product_type": string,',
                    '  "category_hint": string,',
                    '  "user_intent": string,',
                    '  "exact_phrase": string',
                    "}",
                    "corrected_query = fixed spelling of what user meant (same language as input).",
                    "primary = best short English wholesale search phrase (2-5 words).",
                    "keywords = up to 8 variants: synonyms, plural/singular, material, color, category.",
                    "exact_phrase = phrase most likely to match product title exactly.",
                    "user_intent = one short sentence describing what the buyer is looking for.",
                ].join("\n"),
            }],
            temperature: 0.15,
        });
        const llmTimeoutMs = Math.min(
            Math.max(Number(process.env.SEARCH_LLM_TIMEOUT_MS || 4000), 1500),
            12000
        );
        let timer;
        const content = await Promise.race([
            llmPromise.then((result) => result?.content || ""),
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(""), llmTimeoutMs);
            }),
        ]).finally(() => {
            if (timer) clearTimeout(timer);
        });
        if (!content) return baseline;

        const parsed = parseJsonFromLlm(content);
        const correctedQuery = normalizeTerm(parsed?.corrected_query || parsed?.primary || baseline.correctedQuery);
        const primary = normalizeTerm(parsed?.primary || correctedQuery || baseline.primary);
        const exactPhrase = normalizeTerm(parsed?.exact_phrase || primary);
        const keywords = uniqueTerms([
            exactPhrase,
            primary,
            correctedQuery,
            baseline.original,
            parsed?.product_type,
            parsed?.category_hint,
            ...(Array.isArray(parsed?.keywords) ? parsed.keywords : []),
        ]);

        const expanded = {
            original: baseline.original,
            correctedQuery: correctedQuery || primary || baseline.original,
            primary: primary || correctedQuery || baseline.original,
            keywords: keywords.length ? keywords : [primary || baseline.original],
            productType: String(parsed?.product_type || baseline.productType || "").trim(),
            categoryHint: String(parsed?.category_hint || baseline.categoryHint || "").trim(),
            userIntent: String(parsed?.user_intent || "").trim(),
            exactPhrase: exactPhrase || primary,
            aiExpanded: true,
        };
        setCachedQuery(cacheKey, expanded);
        return expanded;
    } catch (error) {
        console.warn("AI text search expansion failed:", error?.message || error);
        setCachedQuery(cacheKey, baseline);
        return baseline;
    }
};

module.exports = {
    isAiTextSearchEnabled,
    expandSearchQuery,
    basicQueryCleanup,
    inferCommonProductIntent,
    uniqueTerms,
    normalizeTerm,
};
