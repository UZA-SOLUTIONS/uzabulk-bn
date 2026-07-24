const esProductService = require("./esProductService");
const { getElasticsearchAvailability } = require("../../../elasticsearch/availability");

const CACHE_TTL_MS = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_CACHE_MS || 300000), 60000),
    900000
);
const LIVE_TOKEN_LIMIT = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_MAX_TOKENS || 2), 1),
    4
);
const LIVE_HITS_PER_TOKEN = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_HITS || 6), 3),
    12
);

const tokenCache = new Map();

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const tokenize = (value = "") =>
    normalizeTerm(value).split(" ").filter((word) => word.length > 2);

const STOP_WORDS = new Set([
    "the", "and", "with", "for", "from", "product", "products", "item", "items",
    "wholesale", "bulk", "new", "hot",
]);

const WEAK_TOKENS = new Set([
    "pink", "beige", "green", "olive", "black", "white", "blue", "red", "gray", "grey",
    "cotton", "silicone", "metal", "plastic", "leather", "solid", "basic", "modern",
    "standard", "smooth", "soft", "color", "colour", "style",
]);

const extractNamePhrases = (name = "", identityTokens = new Set()) => {
    const words = tokenize(name).filter((word) => !STOP_WORDS.has(word));
    const phrases = new Set();
    if (words.length >= 2) phrases.add(words.slice(0, 2).join(" "));
    if (words.length >= 3) phrases.add(words.slice(0, 3).join(" "));
    if (words.length >= 4) phrases.add(words.slice(0, 4).join(" "));

    // Keep only phrases that still mention the scanned product identity.
    if (!identityTokens.size) return [...phrases];
    return [...phrases].filter((phrase) => {
        const phraseWords = phrase.split(" ");
        return phraseWords.some((word) => identityTokens.has(word));
    });
};

const getCachedNames = (token) => {
    const entry = tokenCache.get(token);
    if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) {
        tokenCache.delete(token);
        return null;
    }
    return entry.names;
};

const setCachedNames = (token, names) => {
    tokenCache.set(token, { names, ts: Date.now() });
    while (tokenCache.size > 80) {
        tokenCache.delete(tokenCache.keys().next().value);
    }
};

const fetchCatalogNamesForToken = async (token) => {
    const cached = getCachedNames(token);
    if (cached) return cached;

    const payload = await esProductService.list({
        search: token,
        limit: LIVE_HITS_PER_TOKEN,
        skip: 1,
        orderBy: "relevance",
    });

    const names = (payload?.items || [])
        .map((row) => String(row?.name || "").trim())
        .filter(Boolean);

    setCachedNames(token, names);
    return names;
};

/**
 * Query-time needle expansion — learns phrasing from ES hits.
 * Only expands using strong identity tokens (not colors/materials alone).
 */
const expandNeedlesFromLiveCatalog = async ({
    needles = [],
    primaryKeyword = "",
    searchPhrase = "",
    objectLabel = "",
    keywords = [],
    productType = "",
    maxExtra = 3,
} = {}) => {
    if (!(await getElasticsearchAvailability())) {
        return needles;
    }

    const identityTokens = new Set(
        [
            ...tokenize(productType),
            ...tokenize(primaryKeyword),
            ...tokenize(objectLabel),
            ...tokenize(searchPhrase),
        ].filter((token) => !STOP_WORDS.has(token) && !WEAK_TOKENS.has(token))
    );

    const seen = new Set(
        (needles || []).map((needle) => normalizeTerm(needle)).filter(Boolean)
    );
    const extra = [];

    const add = (value) => {
        const distilled = normalizeTerm(value);
        if (!distilled || distilled.length < 3 || seen.has(distilled)) return;
        // Must keep identity overlap — prevents "olive" → "olive fruit powder".
        if (identityTokens.size) {
            const words = distilled.split(" ");
            if (!words.some((word) => identityTokens.has(word))) return;
        }
        seen.add(distilled);
        extra.push(distilled);
    };

    // Prefer concrete identity tokens over colors/materials.
    const visionTokens = [...identityTokens].slice(0, LIVE_TOKEN_LIMIT);
    if (!visionTokens.length) {
        return needles;
    }

    for (const token of visionTokens) {
        if (extra.length >= maxExtra) break;
        try {
            const names = await fetchCatalogNamesForToken(token);
            names.forEach((name) => {
                if (extra.length >= maxExtra) return;
                extractNamePhrases(name, identityTokens).forEach(add);
            });
        } catch (error) {
            console.warn(`[catalog-vocab-live] token="${token}" failed:`, error?.message || error);
        }
    }

    return [...(needles || []), ...extra.slice(0, maxExtra)];
};

module.exports = {
    expandNeedlesFromLiveCatalog,
};
