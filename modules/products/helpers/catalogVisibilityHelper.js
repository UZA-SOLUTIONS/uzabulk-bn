const RESTRICTED_NAME_RE = /\b(underwear|underwears|lingerie|panties|panty|briefs|thong|boxer\s*briefs?|bras?\b|nightwear|nightgown|nightdress|intimate|qqny|sexy\s*underwear|sexy\s*lingerie|underpants|undergarment|crotch|pajamas?\s*sexy|sex\s*underwear|passion\s+clothes|bunny\s+christmas\s+clothes)\b/i;

const RESTRICTED_CJK_RE = /(内裤|内衣裤|内衣|胸罩|文胸|丁字裤|情趣内衣|情趣套装|性感内衣|女士内裤|男士内裤|开裆)/;

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

const isRestrictedCatalogProduct = (product) => {
    if (!product) return true;
    const combined = collectCatalogText(product);
    if (!combined || /\btest\b/i.test(combined)) return true;
    if (RESTRICTED_NAME_RE.test(combined)) return true;
    if (RESTRICTED_CJK_RE.test(combined)) return true;
    return false;
};

const filterCatalogProducts = (products = []) => (
    Array.isArray(products) ? products.filter((product) => !isRestrictedCatalogProduct(product)) : []
);

const usableCatalogSort = {
    sold_count: -1,
    average_rating: -1,
    date_created_utc: -1,
    _id: -1,
};

module.exports = {
    isRestrictedCatalogProduct,
    filterCatalogProducts,
    usableCatalogSort,
};
