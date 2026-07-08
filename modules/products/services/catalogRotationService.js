const Product = require("../../../models/productsTable");
const {
    expandCategoryFilterIds,
    buildMongoCategoryMatch,
} = require("./categoryFilterHelper");
const {
    balanceCatalogProducts,
    isBlockedCatalogProduct,
} = require("../helpers/catalogVisibilityHelper");

const DEFAULT_LIMIT = 24;

const productProjection = {
    name: 1,
    price: 1,
    bestSeller: 1,
    compare_price: 1,
    images: 1,
    featured_image: 1,
    average_rating: 1,
    rating_count: 1,
    short_description: 1,
    manage_stock: 1,
    stock_quantity: 1,
    stock_status: 1,
    isFeatured: 1,
    date_created_utc: 1,
    featureAttribute: 1,
    offerId: 1,
    categories: 1,
    sold_count: 1,
};

const getSeedNumber = (value = "") => {
    const input = String(value || "");
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash) + input.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
};

const dedupeProductList = (products = []) => {
    const seen = new Set();
    const unique = [];
    products.forEach((product) => {
        const key = String(product?._id || product?.id || product?.offerId || "").trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        unique.push(product);
    });
    return unique;
};

const shuffleProductsBySeed = (products = [], seedKey = "") => {
    if (!products.length || !seedKey) return products;
    return [...products].sort((a, b) => {
        const idA = String(a?._id || a?.id || "");
        const idB = String(b?._id || b?.id || "");
        return getSeedNumber(`${seedKey}:${idA}`) - getSeedNumber(`${seedKey}:${idB}`);
    });
};

const populateProductCards = (query) => query
    .select(productProjection)
    .populate({ path: "featured_image", select: "link -_id" })
    .lean();

const ROTATION_SORT = { date_created_utc: -1, _id: -1 };

const fetchUsableProducts = async ({
    match,
    offset = 0,
    targetLimit,
    sort = ROTATION_SORT,
}) => {
    const safeLimit = Math.max(1, Number(targetLimit) || DEFAULT_LIMIT);
    let products = [];
    let cursor = Math.max(0, Number(offset) || 0);
    const batchSize = Math.min(Math.max(safeLimit * 2, 36), 96);
    let guard = 0;
    const maxGuard = safeLimit > 32 ? 4 : 3;

    while (products.length < safeLimit && guard < maxGuard) {
        guard += 1;
        const batch = await populateProductCards(
            Product.find(match)
                .sort(sort)
                .skip(cursor)
                .limit(batchSize)
        );
        if (!batch.length) break;
        products.push(...batch.filter((product) => !isBlockedCatalogProduct(product)));
        cursor += batch.length;
        if (batch.length < batchSize) break;
    }

    return balanceCatalogProducts(dedupeProductList(products), { maxSensitive: 0 }).slice(0, safeLimit);
};

const getRotatedProducts = async ({
    limit = DEFAULT_LIMIT,
    category = null,
    seedKey = "",
    mixedCategoriesOnly = false,
    excludeMixedCategories = false,
    allowFill = true,
} = {}) => {
    const match = { status: "active" };
    if (category) {
        const categoryIds = await expandCategoryFilterIds(category);
        const categoryMatch = buildMongoCategoryMatch(categoryIds);
        if (categoryMatch) Object.assign(match, categoryMatch);
    }
    if (mixedCategoriesOnly) {
        match.$expr = { $gte: [{ $size: "$categories" }, 2] };
    } else if (excludeMixedCategories) {
        match.$expr = { $eq: [{ $size: "$categories" }, 1] };
    }

    const targetLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 320));
    const poolTarget = Math.min(Math.max(targetLimit + 16, Math.ceil(targetLimit * 1.5)), 160);
    const offset = getSeedNumber(`${seedKey}:${category || "all"}:offset`) % 96;

    let products = await fetchUsableProducts({
        match,
        offset,
        targetLimit: poolTarget,
        sort: ROTATION_SORT,
    });

    products = shuffleProductsBySeed(products, seedKey).slice(0, targetLimit);

    if (allowFill && products.length < targetLimit) {
        const fillProducts = await fetchUsableProducts({
            match,
            offset: 0,
            targetLimit: targetLimit - products.length,
            sort: ROTATION_SORT,
        });
        const seen = new Set(products.map((product) => String(product._id)));
        products = [
            ...products,
            ...fillProducts.filter((product) => !seen.has(String(product._id))),
        ];
    }

    return dedupeProductList(products);
};

/** Page through the full active catalog (not a small fixed pool). */
const getPaginatedCatalogPage = async ({
    limit = DEFAULT_LIMIT,
    page = 1,
    category = null,
    seedKey = "",
} = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 64));
    const safePage = Math.max(1, Math.floor(Number(page) || 1));

    const match = { status: "active" };
    if (category) {
        const categoryIds = await expandCategoryFilterIds(category);
        const categoryMatch = buildMongoCategoryMatch(categoryIds);
        if (categoryMatch) Object.assign(match, categoryMatch);
    }

    const seedOffset = getSeedNumber(`${seedKey}:${category || "all"}:offset`) % 96;
    const mongoOffset = seedOffset + (safePage - 1) * safeLimit;

    const batch = await fetchUsableProducts({
        match,
        offset: mongoOffset,
        targetLimit: safeLimit + 8,
        sort: ROTATION_SORT,
    });

    const items = batch.slice(0, safeLimit);
    const hasMore = batch.length > safeLimit;

    return {
        items,
        hasMore,
        total: hasMore ? mongoOffset + items.length + 1 : mongoOffset + items.length,
    };
};

module.exports = {
    DEFAULT_LIMIT,
    productProjection,
    getSeedNumber,
    dedupeProductList,
    populateProductCards,
    fetchUsableProducts,
    getRotatedProducts,
    getPaginatedCatalogPage,
};
