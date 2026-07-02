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
        categoryNames,
    ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
};

/** Broken/placeholder rows — always exclude from browse surfaces. */
const isBlockedCatalogProduct = (product) => {
    if (!product) return true;
    const combined = collectCatalogText(product);
    if (!combined || /\btest\b/i.test(combined)) return true;
    return false;
};

/** No category-based catalog restrictions (underwear etc. are allowed). */
const isSensitiveCatalogProduct = () => false;

/** @deprecated Use isBlockedCatalogProduct only. */
const isRestrictedCatalogProduct = (product) => isBlockedCatalogProduct(product);

const isExplicitSensitiveSearch = () => false;

/** Drop invalid/test rows only — preserve source order. */
const balanceCatalogProducts = (products = []) => {
    if (!Array.isArray(products) || !products.length) return [];
    return products.filter((product) => !isBlockedCatalogProduct(product));
};

const filterCatalogProducts = (products = []) => balanceCatalogProducts(products);

const usableCatalogSort = {
    sold_count: -1,
    average_rating: -1,
    date_created_utc: -1,
    _id: -1,
};

module.exports = {
    isBlockedCatalogProduct,
    isSensitiveCatalogProduct,
    isRestrictedCatalogProduct,
    isExplicitSensitiveSearch,
    balanceCatalogProducts,
    filterCatalogProducts,
    usableCatalogSort,
};
