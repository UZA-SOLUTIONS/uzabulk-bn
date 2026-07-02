const esProductService = require("./esProductService");
const { getElasticsearchAvailability } = require("../../../elasticsearch/availability");

const CACHE_TTL_MS = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_CACHE_MS || 300000), 60000),
    900000
);
const LIVE_TOKEN_LIMIT = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_MAX_TOKENS || 3), 1),
    5
);
const LIVE_HITS_PER_TOKEN = Math.min(
    Math.max(Number(process.env.CATALOG_VOCAB_LIVE_HITS || 8), 4),
    15
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

const extractNamePhrases = (name = "") => {
    const words = tokenize(name).filter((word) => !STOP_WORDS.has(word));
    const phrases = new Set();
    if (words.length >= 2) phrases.add(words.slice(0, 2).join(" "));
    if (words.length >= 3) phrases.add(words.slice(0, 3).join(" "));
    if (words.length >= 4) phrases.add(words.slice(0, 4).join(" "));
    return [...phrases];
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
 * Query-time needle expansion — learns phrasing from ES hits (scales to millions of SKUs).
 * No full-catalog scan; ~3 small ES queries per image search.
 */
const expandNeedlesFromLiveCatalog = async ({
    needles = [],
    primaryKeyword = "",
    searchPhrase = "",
    objectLabel = "",
    keywords = [],
    maxExtra = 6,
} = {}) => {
    if (!(await getElasticsearchAvailability())) {
        return needles;
    }

    const seen = new Set(
        (needles || []).map((needle) => normalizeTerm(needle)).filter(Boolean)
    );
    const extra = [];

    const add = (value) => {
        const distilled = normalizeTerm(value);
        if (!distilled || distilled.length < 3 || seen.has(distilled)) return;
        seen.add(distilled);
        extra.push(distilled);
    };

    const visionTokens = [...new Set([
        ...tokenize(primaryKeyword),
        ...tokenize(searchPhrase),
        ...tokenize(objectLabel),
        ...(Array.isArray(keywords) ? keywords : []).flatMap(tokenize),
    ].filter((token) => !STOP_WORDS.has(token)))].slice(0, LIVE_TOKEN_LIMIT);

    for (const token of visionTokens) {
        if (extra.length >= maxExtra) break;
        try {
            const names = await fetchCatalogNamesForToken(token);
            names.forEach((name) => {
                if (extra.length >= maxExtra) return;
                extractNamePhrases(name).forEach(add);
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
