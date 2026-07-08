const mongoose = require("mongoose");
const productIndex = require("../../../elasticsearch/indexes/productIndex");
const {
    expandCategoryFilterIds,
    expandCategoryFilterIdsBatch,
    buildEsCategoryFilter,
} = require("./categoryFilterHelper");
const { getSeedNumber } = require("./catalogRotationService");
const { isMongoConnected } = require("../../../config/db");
const { balanceCatalogProducts } = require("../helpers/catalogVisibilityHelper");
const { getElasticsearchAvailability } = require("../../../elasticsearch/availability");

const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const POOL_CACHE_TTL_MS = Math.min(
    Math.max(Number(process.env.CATEGORY_THUMB_POOL_CACHE_TTL_MS || 900000), 120000),
    3600000
);
const categoryThumbPoolCache = new Map();

const getThumbPoolCache = (rootId) => {
    const entry = categoryThumbPoolCache.get(String(rootId));
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        categoryThumbPoolCache.delete(String(rootId));
        return null;
    }
    return entry.urls;
};

const setThumbPoolCache = (rootId, urls = []) => {
    const unique = [...new Set((urls || []).map(String).filter(Boolean))];
    if (!unique.length) return;
    categoryThumbPoolCache.set(String(rootId), {
        urls: unique,
        expires: Date.now() + POOL_CACHE_TTL_MS,
    });
};

const collectImageUrlsFromProducts = (products = []) => {
    const urls = [];
    balanceCatalogProducts(Array.isArray(products) ? products : [], { maxSensitive: 0 }).forEach((product) => {
        const url = pickProductImageUrl(product);
        if (url) urls.push(url);
    });
    return [...new Set(urls)];
};

const pickFromUrlPool = (urls = [], rootId, refresh = "") => {
    if (!urls.length) return "";
    const seedOffset = getSeedNumber(`${refresh}:${rootId}`) % urls.length;
    return urls[seedOffset] || urls[0];
};

const ES_THUMB_SORT = [
    { sold_count: { order: "desc", missing: "_last" } },
    { average_rating: { order: "desc", missing: "_last" } },
    { date_created_utc: { order: "desc" } },
];

const pickProductImageUrl = (product) => {
    if (!product) return "";
    const candidates = [
        product.featured_image,
        product.image,
        product.imageUrl,
        product.thumbnail,
        ...(Array.isArray(product.images) ? product.images : []),
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
        if (candidate?.link) return String(candidate.link).trim();
        if (candidate?.url) return String(candidate.url).trim();
    }
    return "";
};

const pickRotatedProductImage = (products = [], rootId, refresh = "") => {
    const pool = balanceCatalogProducts(Array.isArray(products) ? products : [], { maxSensitive: 0 })
        .map((product) => ({ product, url: pickProductImageUrl(product) }))
        .filter((entry) => entry.url);

    if (!pool.length) return "";

    const seedOffset = getSeedNumber(`${refresh}:${rootId}`) % pool.length;
    return pool[seedOffset]?.url || pool[0].url;
};

const buildThumbEsQuery = (categoryIds = [], rootId = "") => {
    const filters = [{ term: { status: "active" } }];
    const should = [];

    const categoryClause = buildEsCategoryFilter(categoryIds);
    if (categoryClause) should.push(categoryClause);

    if (looksLikeObjectId(rootId)) {
        should.push({ term: { topCategoryId: rootId } });
    }

    if (!should.length) return null;

    return {
        bool: {
            filter: filters,
            should,
            minimum_should_match: 1,
        },
    };
};

const fetchCategoryThumbPool = async (rootId, expandedIds = null) => {
    const root = String(rootId || "").trim();
    if (!looksLikeObjectId(root)) return [];

    const urls = [];

    if (await getElasticsearchAvailability()) {
        try {
            const categoryIds = expandedIds?.length
                ? expandedIds
                : await expandCategoryFilterIds(root);
            const esQuery = buildThumbEsQuery(categoryIds, root);
            if (esQuery) {
                const esResult = await productIndex.search(esQuery, {
                    limit: 12,
                    skip: 0,
                    sort: ES_THUMB_SORT,
                });
                urls.push(...collectImageUrlsFromProducts(esResult?.items || []));
            }
        } catch (err) {
            console.warn(`[categoryThumbnails] ES pool failed for ${root}:`, err?.message || err);
        }
    }

    if (urls.length < 4 && isMongoConnected()) {
        try {
            const topMatches = await _model.Product.find({
                status: "active",
                topCategoryId: root,
                $or: [
                    { featured_image: { $exists: true, $nin: [null, ""] } },
                    { images: { $exists: true, $not: { $size: 0 } } },
                ],
            })
                .sort({ sold_count: -1, average_rating: -1, _id: -1 })
                .limit(8)
                .select({ featured_image: 1, images: 1, name: 1 })
                .lean();
            urls.push(...collectImageUrlsFromProducts(topMatches));
        } catch (err) {
            console.warn(`[categoryThumbnails] Mongo pool topCategoryId failed for ${root}:`, err?.message || err);
        }
    }

    return [...new Set(urls.filter(Boolean))];
};

const fetchCategoryThumbUrlFromEs = async (
    rootId,
    refresh = "",
    { skip = 0, limit = 10, expandedIds = null } = {}
) => {
    const root = String(rootId || "").trim();
    if (!looksLikeObjectId(root)) return "";
    if (!(await getElasticsearchAvailability())) return "";

    try {
        const categoryIds = expandedIds?.length
            ? expandedIds
            : await expandCategoryFilterIds(root);
        if (!categoryIds.length) return "";

        const esQuery = buildThumbEsQuery(categoryIds, root);
        if (!esQuery) return "";

        const esResult = await productIndex.search(esQuery, {
            limit: Math.max(Number(limit) || 10, 8),
            skip: Math.max(Number(skip) || 0, 0),
            sort: ES_THUMB_SORT,
        });

        const items = Array.isArray(esResult?.items) ? esResult.items : [];
        return pickRotatedProductImage(items, root, refresh);
    } catch (err) {
        console.warn(`[categoryThumbnails] ES lookup failed for ${root}:`, err?.message || err);
        return "";
    }
};

const fetchMongoTopCategoryThumb = async (rootId, refresh = "", { skip = 0 } = {}) => {
    if (!isMongoConnected() || !looksLikeObjectId(rootId)) return "";

    try {
        const topMatches = await _model.Product.find({
            status: "active",
            topCategoryId: rootId,
            $or: [
                { featured_image: { $exists: true, $nin: [null, ""] } },
                { images: { $exists: true, $not: { $size: 0 } } },
            ],
        })
            .sort({ sold_count: -1, average_rating: -1, _id: -1 })
            .skip(Math.max(Number(skip) || 0, 0))
            .limit(6)
            .select({ featured_image: 1, images: 1, name: 1 })
            .lean();

        return pickRotatedProductImage(topMatches, rootId, refresh);
    } catch (err) {
        console.warn(`[categoryThumbnails] Mongo topCategoryId failed for ${rootId}:`, err?.message || err);
        return "";
    }
};

const fetchMongoExpandedCategoryThumb = async (rootId, refresh = "", { skip = 0 } = {}) => {
    if (!isMongoConnected() || !looksLikeObjectId(rootId)) return "";

    const thumbSelect = {
        topCategoryId: 1,
        categories: 1,
        featured_image: 1,
        images: 1,
        name: 1,
    };

    const imageMatch = {
        $or: [
            { featured_image: { $exists: true, $nin: [null, ""] } },
            { images: { $exists: true, $not: { $size: 0 } } },
        ],
    };

    try {
        const expanded = await expandCategoryFilterIds(rootId);
        const categoryOids = expanded
            .slice(0, 48)
            .filter(looksLikeObjectId)
            .map((id) => new mongoose.Types.ObjectId(id));

        if (!categoryOids.length) return "";

        const expandedMatches = await _model.Product.find({
            status: "active",
            categories: { $in: categoryOids },
            ...imageMatch,
        })
            .sort({ sold_count: -1, average_rating: -1, _id: -1 })
            .skip(Math.max(Number(skip) || 0, 0))
            .limit(8)
            .select(thumbSelect)
            .lean();

        return pickRotatedProductImage(expandedMatches, rootId, refresh);
    } catch (err) {
        console.warn(`[categoryThumbnails] Mongo categories failed for ${rootId}:`, err?.message || err);
        return "";
    }
};

const fetchRootCategoryThumbUrl = async (
    rootId,
    refresh = "",
    fallbackIcon = "",
    expandedIds = null
) => {
    const cachedPool = getThumbPoolCache(rootId);
    if (cachedPool?.length) {
        const picked = pickFromUrlPool(cachedPool, rootId, refresh);
        if (picked) return picked;
    }

    const pool = await fetchCategoryThumbPool(rootId, expandedIds);
    if (pool.length) {
        setThumbPoolCache(rootId, pool);
        const picked = pickFromUrlPool(pool, rootId, refresh);
        if (picked) return picked;
    }

    const seed = getSeedNumber(`${refresh}:${rootId}`);
    const mongoUrl = await fetchMongoExpandedCategoryThumb(rootId, refresh, {
        skip: seed % 6,
    });
    if (mongoUrl) return mongoUrl;

    return fallbackIcon || "";
};

const resolveCategoryThumbnailsBulk = async (categoryIds = [], refresh = "", iconById = new Map()) => {
    const result = {};
    const roots = [...new Set(categoryIds.map(String).filter(looksLikeObjectId))];
    if (!roots.length) return result;

    const { mapPool } = require("../../../utils/mapPool");
    const concurrency = Math.min(
        Math.max(Number(process.env.CATEGORY_THUMBNAIL_CONCURRENCY || 8), 1),
        12
    );

    let expandedByRoot = new Map();
    try {
        const batch = await expandCategoryFilterIdsBatch(roots);
        expandedByRoot = batch.expandedByRoot || new Map();
    } catch (err) {
        console.warn("[categoryThumbnails] batch category expand failed:", err?.message || err);
    }

    await mapPool(roots, concurrency, async (rootId) => {
        const fallbackIcon = iconById.get(String(rootId)) || "";
        const expandedIds = expandedByRoot.has(rootId)
            ? [...expandedByRoot.get(rootId)]
            : null;
        try {
            const url = await fetchRootCategoryThumbUrl(rootId, refresh, fallbackIcon, expandedIds);
            if (url) result[rootId] = url;
        } catch (err) {
            if (fallbackIcon) result[rootId] = fallbackIcon;
            console.warn(`categoryThumbnails failed for ${rootId}:`, err?.message || err);
        }
    });

    return result;
};

const fetchCategoryThumbListItems = async (categoryId, pageOffset = 0, limit = 1) => {
    const root = String(categoryId || "").trim();
    if (!looksLikeObjectId(root)) return [];

    const url = await fetchCategoryThumbUrlFromEs(root, "", {
        skip: Math.max(Number(pageOffset) || 0, 0),
        limit: Math.max(Number(limit) || 1, 6),
    });
    if (url) {
        return [{ featured_image: url, images: [url] }];
    }

    const topUrl = await fetchMongoTopCategoryThumb(root, "", {
        skip: Math.max(Number(pageOffset) || 0, 0),
    });
    if (topUrl) {
        return [{ featured_image: topUrl, images: [topUrl] }];
    }

    if (!isMongoConnected()) return [];

    const thumbSelect = {
        featured_image: 1,
        images: 1,
        name: 1,
        offerId: 1,
    };
    const imageMatch = {
        $or: [
            { featured_image: { $exists: true, $nin: [null, ""] } },
            { images: { $exists: true, $not: { $size: 0 } } },
        ],
    };

    try {
        const expanded = await expandCategoryFilterIds(root);
        const categoryOids = expanded
            .slice(0, 48)
            .filter(looksLikeObjectId)
            .map((id) => new mongoose.Types.ObjectId(id));
        if (!categoryOids.length) return [];

        const products = await _model.Product.find({
            status: "active",
            categories: { $in: categoryOids },
            ...imageMatch,
        })
            .sort({ sold_count: -1, average_rating: -1, _id: -1 })
            .skip(Math.max(Number(pageOffset) || 0, 0))
            .limit(Math.max(Number(limit) || 1, 4))
            .select(thumbSelect)
            .lean();

        for (const product of products) {
            const imageUrl = pickProductImageUrl(product);
            if (imageUrl) {
                return [{ ...product, featured_image: imageUrl, images: product.images || [imageUrl] }];
            }
        }
    } catch (err) {
        console.warn(`[categoryThumbnails] list poll failed for ${root}:`, err?.message || err);
    }

    return [];
};

module.exports = {
    fetchCategoryThumbUrlFromEs,
    fetchRootCategoryThumbUrl,
    resolveCategoryThumbnailsBulk,
    fetchCategoryThumbListItems,
    pickProductImageUrl,
};
