const normalizeCatalogText = (value = "") =>
    String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

const collectCatalogText = (product) => {
    if (!product) return "";
    const categoryNames = []
        .concat(product?.category?.name, product?.category?.catName)
        .concat(
            Array.isArray(product?.categories)
                ? product.categories.map((cat) => (typeof cat === "string" ? "" : cat?.name || cat?.catName))
                : []
        )
        .filter(Boolean)
        .join(" ");

    return [
        product?.name,
        product?.title,
        product?.short_description,
        product?.description,
        categoryNames,
    ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
};

const SENSITIVE_CATALOG_PATTERNS = [
    /\bunderwear\b/i,
    /\bunderwears\b/i,
    /\blingerie\b/i,
    /\bintimates?\b/i,
    /\bpanties\b/i,
    /\bpanty\b/i,
    /\bbriefs\b/i,
    /\bthong\b/i,
    /\bthongs\b/i,
    /\bunderpants\b/i,
    /\bknickers\b/i,
    /\bboxer\s+shorts\b/i,
    /\bmen['']s\s+underwear\b/i,
    /\bwomen['']s\s+underwear\b/i,
    /\bladies['']?\s+underwear\b/i,
    /\bsexy\s+lingerie\b/i,
    /\bsexy\s+underwear\b/i,
    /\blace\s+bra\b/i,
    /\bbra\s+set\b/i,
    /\bsports?\s+bra\b/i,
    /\bbra\s+and\s+panty\b/i,
    /\bqqny\b/i,
    /\bphysiological\s+pants\b/i,
    /\bperiod\s+panties\b/i,
    /\bnightwear\b/i,
    /\bsleepwear\b/i,
    /内衣/u,
    /内裤/u,
    /文胸/u,
    /情趣/u,
    /生理裤/u,
];

const EXPLICIT_SENSITIVE_SEARCH_PATTERNS = [
    /\bunderwear\b/i,
    /\blingerie\b/i,
    /\bintimates?\b/i,
    /\bpanties\b/i,
    /\bpanty\b/i,
    /\bbriefs\b/i,
    /\bthong\b/i,
    /\bbra\b/i,
    /\bboxers?\b/i,
    /内衣/u,
    /内裤/u,
    /文胸/u,
];

const matchesSensitivePatterns = (text = "", patterns = SENSITIVE_CATALOG_PATTERNS) => {
    const normalized = normalizeCatalogText(text);
    if (!normalized) return false;
    return patterns.some((pattern) => pattern.test(normalized) || pattern.test(text));
};

/** Broken/placeholder rows — always exclude from browse surfaces. */
const isBlockedCatalogProduct = (product) => {
    if (!product) return true;
    const combined = collectCatalogText(product);
    if (!combined || /\btest\b/i.test(combined)) return true;
    return false;
};

const isSensitiveCatalogProduct = (product) => {
    if (!product) return false;
    return matchesSensitivePatterns(collectCatalogText(product));
};

const isSensitiveCategoryLabel = (label = "") => matchesSensitivePatterns(String(label || ""));

const isExplicitSensitiveSearch = (search = "") => matchesSensitivePatterns(
    String(search || ""),
    EXPLICIT_SENSITIVE_SEARCH_PATTERNS
);

/** @deprecated Use isBlockedCatalogProduct only. */
const isRestrictedCatalogProduct = (product) => isBlockedCatalogProduct(product);

const resolveCatalogVisibilityOptions = (options = {}) => {
    const search = String(options?.search || "").trim();
    const categoryLabels = [
        options?.categoryName,
        ...(Array.isArray(options?.categoryNames) ? options.categoryNames : []),
    ]
        .map((label) => String(label || "").trim())
        .filter(Boolean);

    if (isExplicitSensitiveSearch(search) || categoryLabels.some(isSensitiveCategoryLabel)) {
        return {
            ...options,
            search,
            maxSensitive: Number.MAX_SAFE_INTEGER,
        };
    }

    const maxSensitive = Number.isFinite(Number(options?.maxSensitive))
        ? Math.max(0, Number(options.maxSensitive))
        : 0;

    return { ...options, search, maxSensitive };
};

/**
 * Keep browse feeds usable while pushing underwear/lingerie to the back or out entirely.
 * maxSensitive: 0 hides them on home; higher values allow a few when unavoidable.
 */
const balanceCatalogProducts = (products = [], options = {}) => {
    if (!Array.isArray(products) || !products.length) return [];

    const { maxSensitive, search } = resolveCatalogVisibilityOptions(options);
    const usable = products.filter((product) => !isBlockedCatalogProduct(product));

    if (maxSensitive === Number.MAX_SAFE_INTEGER) {
        return usable;
    }

    const regular = [];
    const sensitive = [];

    usable.forEach((product) => {
        if (isSensitiveCatalogProduct(product)) sensitive.push(product);
        else regular.push(product);
    });

    if (!sensitive.length) return regular;

    const cap = Math.max(0, Number(maxSensitive) || 0);
    if (!cap) return regular;

    return [...regular, ...sensitive.slice(0, cap)];
};

const filterCatalogProducts = (products = [], options = {}) => balanceCatalogProducts(products, options);

const usableCatalogSort = {
    sold_count: -1,
    average_rating: -1,
    date_created_utc: -1,
    _id: -1,
};

module.exports = {
    isBlockedCatalogProduct,
    isSensitiveCatalogProduct,
    isSensitiveCategoryLabel,
    isRestrictedCatalogProduct,
    isExplicitSensitiveSearch,
    balanceCatalogProducts,
    filterCatalogProducts,
    usableCatalogSort,
};
