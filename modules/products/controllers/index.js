const Product = require('../services');
const { processVariations } = require("../../../utils");
const { enrichProductReviewsAndRatings } = require('../helper/ratings');
const { isValidObjectId } = require('../../../validators/validator');
const { priceExchange } = require('../../../helpers/helper');
const { mapPool } = require('../../../utils/mapPool');
const { isMongoConnected } = require('../../../config/db');
const { withPromiseTimeout } = require('../../../utils/mongoQueryOptions');
const { beginImageSearch, endImageSearch, isImageSearchBusy, markImageSearchPending } = require('../../../utils/imageSearchGate');
const productIndex = require('../../../elasticsearch/indexes/productIndex');
const esProductService = require('../services/esProductService');
const { getProductDetail, searchImageQuery } = require('../services/alibaba');
const { searchGoogleImageKeywords } = require('../services/googleImageSearch');
const { searchLocalImage, searchLocalImageLive } = require('../services/localImageSearch');
const { updateProductDetails } = require('../helper/migration');
const {
    getRecommendedProducts,
    getPersonalizedProductPage,
    getPersonalizedNewArrivalsPage,
    getHomeBrowseProductPage,
    getRotatedProductPage,
    buildCatalogSeedKey,
    trackProductBehavior,
} = require('../services/recommendationService');
const { runSmartListing, analyzeProductImage: analyzeImageAi } = require('../../ai/services/smartListingService');
const { getSimilarProducts, ensureProductEmbedding } = require('../services/similarProductsService');
const { ensureRelatedProducts } = require('../services/aiRecommendationService');
const { searchCatalogByText } = require('../services/catalogSearchService');
const {
    resolveImageSearchFromAi,
    extractImageSearchKeywords,
} = require('../../ai/services/aiImageSearchService');
const { guessLocalImagePath } = require('../../ai/helpers/resolveVisionImageInput');
const {
    expandCategoryFilterIds,
    buildMongoCategoryMatch,
} = require('../services/categoryFilterHelper');
const { runImageSearchPipeline, searchAlibabaCatalogByKeywords } = require('../helper/imageSearchPipeline');
const { resolveSmartImageSearch } = require('../../ai/services/smartImageSearchService');
const { expandSearchQuery } = require('../../ai/services/aiTextSearchService');
const { isElasticsearchReachable } = require('../../../elasticsearch/availability');
const { filterCatalogProducts } = require('../helpers/catalogVisibilityHelper');
const { getSeedNumber } = require('../services/catalogRotationService');

const visibleCatalogItems = (items = []) => filterCatalogProducts(Array.isArray(items) ? items : []);

const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchText = (value = "") => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

const filterItemsBySearchTokens = (items = [], search = "") => {
    const normalizedQuery = normalizeSearchText(search);
    if (!normalizedQuery) return items;

    const tokens = normalizedQuery.split(" ").filter(Boolean);
    if (!tokens.length) return items;

    return items.filter((item) => {
        const haystack = normalizeSearchText(
            [
                item?.name,
                item?.sku,
                item?.slug,
                item?.short_description,
                item?.description,
            ]
                .filter(Boolean)
                .join(" ")
        );
        return tokens.every((token) => haystack.includes(token));
    });
};

const shouldRefreshSupplierProduct = (product) => {
    if (!product?.offerId) return false;
    if (!product.last_updated) return true;

    const lastUpdated = new Date(product.last_updated);
    if (Number.isNaN(lastUpdated.getTime())) return true;

    const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return ageHours >= 24;
};

const syncSupplierProductInBackground = (product) => {
    const productId = product?._id;
    const offerId = product?.offerId;
    if (!productId || !offerId) return;

    getProductDetail(offerId)
        .then(async (productDetails) => {
            if (productDetails && productDetails?.status && productDetails?.status !== "published") {
                await module.exports.productArchived(productId);
                return;
            }

            if (productDetails?.status === "published") {
                await updateProductDetails(product, productDetails);
            }
        })
        .catch((error) => {
            console.warn(`Background product sync failed for offerId=${offerId}:`, error.message);
        });
};

/** ES `productIndex.search` returns `{ items, total }`; older paths may still return a bare array. */
const unwrapEsSearchResult = (result) => {
    if (Array.isArray(result)) {
        return { items: result, total: 0, tookMs: 0, timedOut: false };
    }
    const items = result?.items || [];
    const total = typeof result?.total === "number" ? result.total : 0;
    return {
        items,
        total,
        tookMs: typeof result?.tookMs === "number" ? result.tookMs : 0,
        timedOut: Boolean(result?.timedOut),
    };
};

const getMongoListQuery = ({ category, fieldName, fieldValue, search, singleCategoryOnly = false } = {}) => {
    const query = { status: "active" };

    if (category && isValidObjectId(category)) {
        query.categories = category;
    }
    if (singleCategoryOnly) {
        query.$expr = { $eq: [{ $size: "$categories" }, 1] };
    }
    if (fieldName && fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== "") {
        query[fieldName] = fieldValue;
    }
    if (search && String(search).trim()) {
        const tokens = String(search)
            .trim()
            .split(/\s+/)
            .map((token) => escapeRegex(token))
            .filter(Boolean);
        if (tokens.length) {
            query.$and = tokens.map((token) => ({
                name: { $regex: new RegExp(token, "i") },
            }));
        }
    }

    return query;
};

const normalizeFeaturedImageLink = (items = []) => items.map((item) => {
    if (item?.featured_image?.link) {
        return { ...item, featured_image: item.featured_image.link };
    }
    return item;
});

const getSeedHash = (key = "") => {
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const getCategoryRepresentativeSkip = (categoryId, refresh = "", poolSize = 8) => {
    const token = refresh || "0";
    return (getSeedHash(`${categoryId}:${token}:img`) % poolSize) + 1;
};

const pickProductImageUrl = (product) => {
    if (!product) return "";
    if (typeof product?.featured_image === "string" && product.featured_image.trim()) {
        return product.featured_image.trim();
    }
    if (product?.featured_image?.link) {
        return String(product.featured_image.link).trim();
    }
    const first = Array.isArray(product?.images) ? product.images[0] : null;
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first?.link) return String(first.link).trim();
    return "";
};

const resolveCategoryIconUrl = async (categoryId) => {
    const cat = await _model.Category.findById(categoryId)
        .populate({ path: "catImage", select: "link -_id" })
        .lean();
    if (!cat) return "";
    const img = cat.catImage;
    if (typeof img === "string" && img.trim()) return img.trim();
    if (img?.link) return String(img.link).trim();
    return "";
};

const trimPaginationItems = (items = [], limit = 10) => {
    const safeLimit = Math.max(1, Number(limit) || 10);
    return {
        items: items.slice(0, safeLimit),
        hasMore: items.length > safeLimit,
    };
};

const resolveActiveCatalogItems = async (items = []) => {
    if (!Array.isArray(items) || !items.length) return [];

    const mongoIds = [];
    const offerIds = [];

    items.forEach((item) => {
        const mongoId = String(item?._id || "").trim();
        const offerId = String(item?.offerId || "").trim();
        if (looksLikeObjectId(mongoId)) {
            mongoIds.push(mongoId);
        }
        if (offerId) {
            offerIds.push(offerId);
        }
    });

    if (!mongoIds.length && !offerIds.length) return [];

    const orQuery = [];
    if (mongoIds.length) {
        orQuery.push({ _id: { $in: [...new Set(mongoIds)] } });
    }
    if (offerIds.length) {
        orQuery.push({ offerId: { $in: [...new Set(offerIds)] } });
    }

    const activeProducts = await _model.Product.find({
        status: "active",
        $or: orQuery,
    })
        .select("_id offerId")
        .lean();

    if (!activeProducts.length) return [];

    const byId = new Map();
    const byOfferId = new Map();
    activeProducts.forEach((product) => {
        const id = String(product._id);
        byId.set(id, product);
        if (product.offerId) {
            byOfferId.set(String(product.offerId), product);
        }
    });

    const usedIds = new Set();
    const resolved = [];

    items.forEach((item) => {
        const currentId = String(item?._id || "").trim();
        const currentOfferId = String(item?.offerId || "").trim();

        let matched = null;
        if (looksLikeObjectId(currentId) && byId.has(currentId)) {
            matched = byId.get(currentId);
        } else if (currentOfferId && byOfferId.has(currentOfferId)) {
            matched = byOfferId.get(currentOfferId);
        }

        if (!matched) return;

        const resolvedId = String(matched._id);
        if (usedIds.has(resolvedId)) return;
        usedIds.add(resolvedId);

        resolved.push({
            ...item,
            _id: resolvedId,
            offerId: item?.offerId || matched?.offerId || "",
        });
    });

    return resolved;
};

const imageProjection = {
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
};

const CATEGORY_THUMBNAIL_CONCURRENCY = Math.min(
    Math.max(Number(process.env.CATEGORY_THUMBNAIL_CONCURRENCY || 1), 1),
    4
);

const safeCategoryById = async (categoryId) => {
    if (!categoryId || !isMongoConnected()) return null;
    try {
        return await withPromiseTimeout(
            _model.Category.findById(categoryId),
            4000,
            null
        );
    } catch (err) {
        console.warn("[products] category lookup failed:", err?.message || err);
        return null;
    }
};

const safePriceExchange = async (items, exchangeRate) => {
    if (!items || (Array.isArray(items) && !items.length)) return;
    try {
        await priceExchange(items, exchangeRate);
    } catch (err) {
        console.warn("[products] price exchange failed:", err?.message || err);
    }
};

const fetchCategoryThumbnailUrl = async (categoryId, refresh = "") => {
    if (!isMongoConnected()) return "";

    let categoryIds = [categoryId];
    try {
        categoryIds = await expandCategoryFilterIds(categoryId);
    } catch (err) {
        console.warn(`[categoryThumbnails] expandCategoryFilterIds failed for ${categoryId}:`, err?.message || err);
    }

    const match = {
        status: "active",
        featured_image: { $exists: true, $nin: [null, ""] },
    };
    const categoryMatch = buildMongoCategoryMatch(categoryIds);
    if (categoryMatch) Object.assign(match, categoryMatch);

    try {
        const skip = getSeedNumber(`${refresh}:${categoryId}`) % 32;
        const products = visibleCatalogItems(await _model.Product.find(match)
            .sort({ sold_count: -1, average_rating: -1, _id: -1 })
            .skip(skip)
            .limit(12)
            .select(imageProjection)
            .lean());

        for (const product of products) {
            const url = pickProductImageUrl(product);
            if (url) return url;
        }
    } catch (err) {
        console.warn(`[categoryThumbnails] product query failed for ${categoryId}:`, err?.message || err);
    }

    try {
        return await resolveCategoryIconUrl(categoryId);
    } catch (_) {
        return "";
    }
};

const mapProductsByOfferOrder = async (offerIds = []) => {
    const uniq = [...new Set(
        (offerIds || []).map((id) => String(id || "").trim()).filter(Boolean)
    )];
    if (!uniq.length) return [];

    const found = await _model.Product.find({
        status: "active",
        offerId: { $in: uniq },
    })
        .select(imageProjection)
        .lean();

    const byOffer = new Map(found.map((p) => [String(p.offerId), p]));
    const items = [];
    uniq.forEach((id) => {
        const p = byOffer.get(id);
        if (!p) return;
        const img = p.featured_image;
        items.push(
            img && typeof img === "object" && img.link
                ? { ...p, featured_image: img.link }
                : { ...p }
        );
    });
    return items;
};

module.exports = {
    topRankingProductsOld: async (req, res) => {
        try {

            let query = { status: "active", };//isFeatured: true

            let items = await Product.getTopRankingProducts(query, req.paginationOptions);
            let total = await Product.countData(query);

            return res.success(req.nextPageOptions(items, total));

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    newArrivalProductsOld: async (req, res) => {
        try {

            let query = { status: "active" };

            let items = await Product.getNewArrivalsProducts(query, req.paginationOptions);
            let total = await Product.countData(query);

            return res.success(req.nextPageOptions(items, total));

        } catch (error) {
            res.error(error)
        }
    },
    getSavingsSpotlightOld: async (req, res) => {
        try {

            let query = { status: "active" };

            let items = await Product.getSavingsSpotlight(query, req.paginationOptions);
            let total = await Product.countData(query);

            return res.success(req.nextPageOptions(items, total));

        } catch (error) {
            res.error(error)
        }
    },
    searchAutocomplete: async (req, res) => {
        try {
            const { search = "", category } = req.query;
            const limit = Math.max(1, Math.min(parseInt(req.query?.limit, 10) || 10, 20));
            const skip = Math.max(0, parseInt(req.query?.skip, 10) || 0);

            if (!search)
                return res.success("RECORD_FOUND", []);

            const aiSearch = await searchCatalogByText({
                search,
                limit,
                skip,
                category,
                fast: true,
                skipExternal: true,
            });
            const items = visibleCatalogItems(normalizeFeaturedImageLink(aiSearch.items || []));

            return res.success("RECORD_FOUND", items, {
                searchMeta: aiSearch.searchMeta || {
                    searchQuery: search,
                },
            });

        } catch (error) {
            console.error(error);
            res.error(error);
        }
    },
    topRankingProducts: async (req, res) => {
        try {

            const { skip, limit } = req.paginationOptions;
            let items = [];
            let total = 0;
            let hasMore;

            try {
                const { items: rawItems, total: esTotal } = unwrapEsSearchResult(
                    await esProductService.filter({
                        limit,
                        skip,
                        sort: {
                            average_rating: {
                                order: "desc"
                            }
                        }
                    })
                );
                items = visibleCatalogItems(await resolveActiveCatalogItems(rawItems));
                total = esTotal;
            } catch (error) {
                const mongoQuery = { status: "active" };
                const page = trimPaginationItems(
                    await Product.getTopRankingProducts(mongoQuery, { ...req.paginationOptions, limit: limit + 1 }),
                    limit
                );
                items = visibleCatalogItems(page.items);
                hasMore = page.hasMore;
                total = skip + items.length + (hasMore ? 1 : 0);
                items = normalizeFeaturedImageLink(items);
            }

            await priceExchange(items, req.exchangeRate);
            return res.success(req.nextPageOptions(items, total, { hasMore }));

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    newArrivalProducts: async (req, res) => {
        try {

            const { skip, limit } = req.paginationOptions;
            const { search, category, refresh } = req.query;
            let items = [];
            let total = 0;
            let hasMore;

            if (!search && !category) {
                const catalogPage = Math.max(1, Number(req.query.skip) || 1);
                const seedKey = `${buildCatalogSeedKey(req, refresh)}:arrivals`;
                const homeFeedFast = req.query.homeFeed === "true" || req.query.homeFeed === true;
                const personalized = homeFeedFast
                    ? await getRotatedProductPage({
                        limit,
                        page: catalogPage,
                        seedKey,
                    })
                    : await getPersonalizedNewArrivalsPage(req, {
                        limit,
                        page: catalogPage,
                        seedKey,
                        refresh,
                    });
                items = visibleCatalogItems(personalized.items);
                hasMore = personalized.hasMore;
                total = personalized.total;
            } else {
                try {
                    const { items: rawItems, total: esTotal } = unwrapEsSearchResult(
                        await esProductService.filter({
                            limit,
                            skip,
                            search,
                            category,
                            sort: {
                                date_created_utc: {
                                    order: "desc"
                                }
                            }
                        })
                    );
                    items = visibleCatalogItems(await resolveActiveCatalogItems(rawItems));
                    total = esTotal;
                } catch (error) {
                    const mongoQuery = getMongoListQuery({ category, search });
                    const page = trimPaginationItems(
                        await Product.getNewArrivalsProducts(mongoQuery, { ...req.paginationOptions, limit: limit + 1 }),
                        limit
                    );
                    items = visibleCatalogItems(page.items);
                    hasMore = page.hasMore;
                    total = skip + items.length + (hasMore ? 1 : 0);
                    items = normalizeFeaturedImageLink(items);
                }
            }

            await priceExchange(items, req.exchangeRate);
            return res.success(req.nextPageOptions(items, total, { hasMore }));

        } catch (error) {
            res.error(error)
        }
    },
    getSavingsSpotlight: async (req, res) => {
        try {
            const { skip, limit } = req.paginationOptions;
            const { search, category } = req.query;
            let items = [];
            let total = 0;
            let hasMore;

            try {
                const { items: rawItems, total: esTotal } = unwrapEsSearchResult(
                    await esProductService.filter({
                        limit,
                        skip,
                        search,
                        category,
                        sort: {
                            price: {
                                order: "asc"
                            }
                        }
                    })
                );
                items = visibleCatalogItems(await resolveActiveCatalogItems(rawItems));
                total = esTotal;
            } catch (error) {
                const mongoQuery = getMongoListQuery({ category, search });
                const page = trimPaginationItems(
                    await Product.getSavingsSpotlight(mongoQuery, { ...req.paginationOptions, limit: limit + 1 }),
                    limit
                );
                items = visibleCatalogItems(page.items);
                hasMore = page.hasMore;
                total = skip + items.length + (hasMore ? 1 : 0);
                items = normalizeFeaturedImageLink(items);
            }

            await priceExchange(items, req.exchangeRate);
            return res.success(req.nextPageOptions(items, total, { hasMore }));

        } catch (error) {
            res.error(error)
        }
    },
    viewOld: async (req, res) => {
        try {
            let { _id } = req.params;
            let query = { _id, status: "active" };

            let item = await Product.view(query);

            if (!item) {
                return res.error("INVALID_PRODUCT_ID");
            };

            item = processVariations(item);

            return res.success(item);

        } catch (error) {
            console.log(error)
            res.error(error)
        }
    },
    /** Resolve catalog Mongo _id from 1688 offerId (numeric string stored on Product.offerId). */
    viewByOfferId: async (req, res) => {
        try {
            const raw = String(req.params.offerId || "").trim();
            if (!raw || raw.length > 32 || !/^\d+$/.test(raw)) {
                return res.error("INVALID_PRODUCT_ID");
            }
            const offerIdCandidates = [raw];
            const noLeadingZeros = raw.replace(/^0+(?=\d)/, "");
            if (noLeadingZeros && noLeadingZeros !== raw) {
                offerIdCandidates.push(noLeadingZeros);
            }
            const product = await _model.Product.findOne({
                status: "active",
                offerId: { $in: [...new Set(offerIdCandidates)] },
            })
                .select("_id")
                .lean();
            if (!product?._id) {
                return res.error("INVALID_PRODUCT_ID");
            }
            return res.success({ _id: String(product._id) });
        } catch (error) {
            console.error(error);
            res.error(error);
        }
    },
    view: async (req, res) => {
        try {
            const productId = String(req.product?._id || req.params._id || "").trim();
            let query = { _id: productId, status: "active" };

            if (shouldRefreshSupplierProduct(req.product)) {
                syncSupplierProductInBackground(req.product);
            }

            let item = await Product.view(query);

            if (!item) {
                return res.error("INVALID_PRODUCT_ID");
            }

            item = processVariations(item);
            item = await withPromiseTimeout(
                enrichProductReviewsAndRatings(item),
                5000,
                item
            );

            await priceExchange(item, req.exchangeRate);

            if (req?.user?._id) {
                void trackProductBehavior(req, {
                    product: item,
                    eventType: "view",
                    score: 1,
                });
            }

            void getSimilarProducts(productId, { limit: 8 })
                .then((similarProducts) => {
                    if (!similarProducts?.length) return;
                    ensureRelatedProducts(productId, { limit: 8 }).catch((err) => {
                        console.warn(`Related products persist failed for ${productId}:`, err?.message);
                    });
                })
                .catch((err) => {
                    console.warn(`[products] similar products skipped for ${productId}:`, err?.message);
                });
            void ensureProductEmbedding(productId).catch((err) => {
                console.warn(`Embedding warmup failed for ${productId}:`, err?.message);
            });

            return res.success(item);

        } catch (error) {
            console.log(error)
            res.error(error)
        }
    },
    adminSellerProducts: async (req, res) => {
        try {

            let query = { status: "active", adminSold: true };
            let { category } = req.query;

            if (category) {
                if (!isValidObjectId(category)) {
                    return res.error("INVALID_CATEGORY_ID");
                }
                query.categories = category;
            } else {
                query.isFeatured = true;
            };

            let items = await Product.list(query, req.paginationOptions);
            let total = await Product.countData(query);

            return res.success(req.nextPageOptions(items, total));

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    listOld: async (req, res) => {
        try {

            let query = { status: "active" };
            let { category, fieldName, fieldValue } = req.query;

            if (category) {
                if (!isValidObjectId(category)) {
                    return res.error("INVALID_CATEGORY_ID");
                }
                query.categories = category;
            }

            if (fieldName && fieldValue) {
                query[fieldName] = fieldValue;
            }

            let items = await Product.list(query, req.paginationOptions);
            let total = await Product.countData(query);

            return res.success(req.nextPageOptions(items, total));

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    list: async (req, res) => {
        try {
            const { category, fieldName, fieldValue, search, image, country, refresh, singleCategoryOnly } = req.query;
            const { limit, skip } = req.paginationOptions;
            const imageUrl = typeof image === "string" ? image.trim() : "";
            const onlySingleCategory = singleCategoryOnly === "1" || singleCategoryOnly === "true";
            const isCategoryThumbPoll = Boolean(category)
                && !imageUrl
                && !search
                && !fieldName
                && !fieldValue
                && Number(req.query.limit) === 1;

            if (isImageSearchBusy() && isCategoryThumbPoll) {
                return res.success(req.nextPageOptions([], 0, { deferred: true }));
            }

            const useRotatedBrowse =
                !imageUrl
                && !search
                && !category
                && !fieldName
                && !fieldValue;

            if (useRotatedBrowse) {
                const catalogPage = Math.max(1, Number(req.query.skip) || 1);
                const seedKey = `${buildCatalogSeedKey(req, refresh)}:browse`;
                const homeBrowseFast = req.query.homeBrowse === "true" || req.query.homeBrowse === true;

                if (homeBrowseFast) {
                    let browseItems = [];
                    let total = 0;
                    let hasMore = false;
                    let usedElasticsearch = false;

                    try {
                        const esPayload = unwrapEsSearchResult(
                            await esProductService.list({ limit, skip })
                        );
                        if (esPayload.items?.length || esPayload.total > 0) {
                            browseItems = visibleCatalogItems(
                                await resolveActiveCatalogItems(esPayload.items)
                            );
                            total = esPayload.total;
                            hasMore = skip + browseItems.length < esPayload.total;
                            usedElasticsearch = true;
                        }
                    } catch (esError) {
                        console.warn("homeBrowse ES list failed, using catalog rotation:", esError?.message);
                    }

                    if (!usedElasticsearch) {
                        const pageResult = await getHomeBrowseProductPage({
                            limit,
                            page: catalogPage,
                            seedKey,
                        });
                        browseItems = visibleCatalogItems(pageResult.items);
                        total = pageResult.total;
                        hasMore = pageResult.hasMore;
                    }

                    await priceExchange(browseItems, req.exchangeRate);
                    return res.success(req.nextPageOptions(browseItems, total, {
                        category: null,
                        hasMore,
                        personalized: false,
                    }));
                }

                const personalized = await getPersonalizedProductPage(req, {
                        limit,
                        page: catalogPage,
                        seedKey,
                        refresh,
                    });
                const categoryData = null;
                const browseItems = visibleCatalogItems(personalized.items);
                const recentBrowsed = visibleCatalogItems(personalized.recentBrowsed || []);
                await priceExchange(browseItems, req.exchangeRate);
                if (recentBrowsed.length) {
                    await priceExchange(recentBrowsed, req.exchangeRate);
                }
                return res.success(req.nextPageOptions(browseItems, personalized.total, {
                    category: categoryData,
                    hasMore: personalized.hasMore,
                    personalized: true,
                    recentBrowsed,
                }));
            }

            if (imageUrl) {
                const pageNum = Math.max(1, Math.floor(skip / limit) + 1);
                const imageCountry =
                    typeof country === "string" && country.trim() ? country.trim() : "en";

                console.log(`[image-search] list start image=${String(imageUrl).slice(0, 96)}`);

                beginImageSearch();
                let result;
                try {
                    result = await resolveSmartImageSearch({
                        imageUrl,
                        limit,
                        skip: pageNum,
                        category,
                        fieldName,
                        fieldValue,
                        country: imageCountry,
                        fallbackSearch: String(search || "").trim(),
                    });
                } finally {
                    endImageSearch();
                }

                const items = visibleCatalogItems(result.items || []);
                const recommendations = visibleCatalogItems(result.recommendations || []);
                const categoryData = await safeCategoryById(category);
                await safePriceExchange(items, req.exchangeRate);
                if (recommendations.length) {
                    await safePriceExchange(recommendations, req.exchangeRate);
                }

                const vision = result.vision || {};
                console.log(
                    `[image-search] list done items=${items.length} provider=${result.provider || "none"}`
                );
                return res.success(req.nextPageOptions(
                    items,
                    result.total || items.length,
                    {
                        category: categoryData,
                        imageSearch: true,
                        imageSearchProvider: result.provider || "none",
                        imageSearchKeyword: vision.primaryKeyword || vision.objectLabel || String(search || "").trim(),
                        imageSearchObjectLabel: vision.objectLabel || vision.primaryKeyword || "",
                        imageSearchKeywords: vision.keywords || [],
                        imageSearchPhrase: vision.searchPhrase || "",
                        imageUrl,
                        smartListing: result.smartListing || null,
                        smartListingAttributes: vision.attributes || result.smartListing?.attributes || null,
                        recommendations,
                        smartRecommendations: recommendations.length > 0,
                    }
                ));
            }

            let items = [];
            let total = 0;
            let rawEsItems = [];
            let esTotalHits = 0;
            let esTookMs = 0;
            let esTimedOut = false;
            let usedElasticsearch = false;
            let mongoHasMore;
            let aiSearchMeta = null;

            try {
                if (search) {
                    const aiTextSearch = await searchCatalogByText({
                        search,
                        limit,
                        skip,
                        category,
                        fieldName,
                        fieldValue,
                        singleCategoryOnly: onlySingleCategory,
                        skipExternal: true,
                    });
                    rawEsItems = aiTextSearch.items || [];
                    esTotalHits = aiTextSearch.total || 0;
                    aiSearchMeta = aiTextSearch.searchMeta || null;
                    const searchEngine = aiSearchMeta?.engine || "";
                    const useDirectSearchItems =
                        !searchEngine ||
                        searchEngine.includes("mongo") ||
                        searchEngine.includes("alibaba");
                    if (useDirectSearchItems) {
                        items = visibleCatalogItems(normalizeFeaturedImageLink(rawEsItems));
                    } else {
                        items = visibleCatalogItems(await resolveActiveCatalogItems(rawEsItems));
                    }

                } else {
                    const esPayload = unwrapEsSearchResult(
                        await esProductService.list({
                            category, fieldName, fieldValue, search,
                            limit, skip,
                            singleCategoryOnly: onlySingleCategory,
                        })
                    );
                    rawEsItems = esPayload.items;
                    esTotalHits = esPayload.total;
                    esTookMs = esPayload.tookMs || 0;
                    esTimedOut = esPayload.timedOut || false;
                    items = visibleCatalogItems(await resolveActiveCatalogItems(rawEsItems));
                }
                const resolvedCount = items.length;
                const hasMoreFromEs = skip + resolvedCount < esTotalHits;
                total = hasMoreFromEs ? skip + resolvedCount + 1 : skip + resolvedCount;
                usedElasticsearch = true;
            } catch (error) {
                const mongoQuery = getMongoListQuery({
                    category, fieldName, fieldValue, search, singleCategoryOnly: onlySingleCategory,
                });
                const page = trimPaginationItems(
                    await Product.list(mongoQuery, { ...req.paginationOptions, limit: limit + 1 }),
                    limit
                );
                items = visibleCatalogItems(page.items);
                mongoHasMore = page.hasMore;
                total = skip + items.length + (mongoHasMore ? 1 : 0);
                items = normalizeFeaturedImageLink(items);
                items = filterItemsBySearchTokens(items, search);
            }

            const categoryData = category ? await _model.Category.findById(category) : null;

            items = visibleCatalogItems(items);
            await priceExchange(items, req.exchangeRate);
            const listExtras = { category: categoryData };
            if (imageUrl && String(search || "").trim()) {
                listExtras.imageSearch = true;
                listExtras.imageSearchProvider = "dashscope";
                listExtras.imageSearchKeyword = String(search).trim();
                listExtras.imageSearchPhrase = String(search).trim();
                listExtras.imageUrl = imageUrl;
            }
            if (usedElasticsearch) {
                listExtras.hasMore = skip + items.length < esTotalHits;
                listExtras.searchMeta = {
                    latencyMs: esTookMs,
                    timedOut: esTimedOut,
                    ...(aiSearchMeta || { engine: "elasticsearch" }),
                };
            } else if (typeof mongoHasMore === "boolean") {
                listExtras.hasMore = mongoHasMore;
                listExtras.searchMeta = {
                    engine: "mongo_fallback",
                };
            }
            return res.success(req.nextPageOptions(items, total, listExtras));

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    recommended: async (req, res) => {
        try {
            const { limit } = req.paginationOptions;
            const { category, refresh } = req.query;
            const items = visibleCatalogItems(await getRecommendedProducts(req, { limit, category, refresh }));

            await priceExchange(items, req.exchangeRate);
            return res.success(req.nextPageOptions(items, items.length, {
                hasMore: items.length >= limit,
                personalized: Boolean(req.user?._id || req.deviceId),
                aiRecommendations: true,
            }));
        } catch (error) {
            console.error(error);
            res.error(error);
        }
    },
    productArchived: async (productId) => {
        try {
            const updatedProduct = await _model.Product.findByIdAndUpdate(
                productId,
                { status: "archived" },
                { new: true, lean: true }
            );
            await productIndex.set(updatedProduct);

        } catch (error) {
            console.error("productArchived", error)

        }

    },
    frequentlySearch: async (req, res) => {
        try {
            if (!global._model?.FrequentlySearch?.get) {
                return res.success("RECORD_FOUND", []);
            }
            const _data = await _model.FrequentlySearch.get();

            return res.success("RECORD_FOUND", _data);

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },
    /**
     * AI Smart Listing — image URL → VL attributes → listing JSON (seller preview).
     * POST body: { imageUrl, sourcePriceCNY? }
     */
    smartListing: async (req, res) => {
        try {
            const { imageUrl, sourcePriceCNY } = req.body || {};
            if (!imageUrl || !String(imageUrl).trim()) {
                return res.error("IMAGE_URL_REQUIRED");
            }
            const result = await runSmartListing({
                imageUrl: String(imageUrl).trim(),
                sourcePriceCNY,
            });
            return res.success("SMART_LISTING_GENERATED", result);
        } catch (error) {
            console.error("smartListing", error);
            res.error(error?.message || error);
        }
    },

    /** Step 1 only — vision attribute extraction. */
    analyzeProductImage: async (req, res) => {
        try {
            const { imageUrl } = req.body || {};
            if (!imageUrl || !String(imageUrl).trim()) {
                return res.error("IMAGE_URL_REQUIRED");
            }
            const attributes = await analyzeImageAi(String(imageUrl).trim());
            return res.success("IMAGE_ANALYZED", { attributes });
        } catch (error) {
            console.error("analyzeProductImage", error);
            res.error(error?.message || error);
        }
    },

    /** DashScope VL — image URL → catalog search keywords. */
    analyzeImageSearchKeywords: async (req, res) => {
        try {
            const { imageUrl } = req.body || {};
            if (!imageUrl || !String(imageUrl).trim()) {
                return res.error("IMAGE_URL_REQUIRED");
            }
            const keywords = await extractImageSearchKeywords(String(imageUrl).trim());
            if (!keywords) {
                return res.error("AI_IMAGE_SEARCH_DISABLED");
            }
            return res.success("IMAGE_SEARCH_KEYWORDS", keywords);
        } catch (error) {
            console.error("analyzeImageSearchKeywords", error);
            res.error(error?.message || error);
        }
    },

    /** Upload image + smart listing + similar products + recommendations. */
    imageSearchUpload: async (req, res) => {
        try {
            const file = req.file;
            if (!file?.location) {
                return res.error("IMAGE_IS_REQUIRED");
            }

            const imageUrl = String(file.location).trim();
            const prepareOnly =
                req.query.prepare === "1"
                || req.query.prepare === "true"
                || req.query.prepareOnly === "1";

            if (prepareOnly) {
                markImageSearchPending();
                return res.success(req.nextPageOptions([], 0, {
                    imageSearch: true,
                    imageSearchProvider: "upload",
                    imageUrl,
                    prepared: true,
                }));
            }

            const { limit, skip } = req.paginationOptions;
            const { category, fieldName, fieldValue, country } = req.query;

            const result = await resolveSmartImageSearch({
                imageUrl,
                limit,
                skip: Math.max(1, Math.floor((skip || 0) / limit) + 1),
                category,
                fieldName,
                fieldValue,
                country,
            });

            const items = visibleCatalogItems(result.items || []);
            const recommendations = visibleCatalogItems(result.recommendations || []);
            await safePriceExchange(items, req.exchangeRate);
            if (recommendations.length) {
                await safePriceExchange(recommendations, req.exchangeRate);
            }

            const vision = result.vision || {};
            const searchTerm = vision.primaryKeyword || vision.searchPhrase || "";
            if (searchTerm) {
                trackProductBehavior(req, {
                    eventType: "search",
                    search: searchTerm,
                    score: 1,
                    metadata: {
                        imageSearch: true,
                        smartListing: Boolean(result.smartListing),
                        imageUrl,
                        provider: result.provider,
                        resultCount: items.length,
                        recommendationCount: recommendations.length,
                    },
                });
            }

            return res.success(req.nextPageOptions(items, result.total || items.length, {
                imageSearch: true,
                imageSearchProvider: result.provider || "none",
                imageSearchKeyword: vision.primaryKeyword || vision.objectLabel || "",
                imageSearchObjectLabel: vision.objectLabel || vision.primaryKeyword || "",
                imageSearchKeywords: vision.keywords || [],
                imageSearchPhrase: vision.searchPhrase || "",
                imageUrl,
                smartListing: result.smartListing || null,
                smartListingAttributes: vision.attributes || result.smartListing?.attributes || null,
                recommendations,
                smartRecommendations: recommendations.length > 0,
            }));
        } catch (error) {
            console.error("imageSearchUpload", error);
            res.error(error?.message || error);
        }
    },

    /** Embedding-based similar products (AI recommendations). */
    similarProducts: async (req, res) => {
        try {
            const productId = req.params.productId;
            if (!isValidObjectId(productId)) {
                return res.error("INVALID_PRODUCT_ID");
            }
            const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 24);
            const items = visibleCatalogItems(await getSimilarProducts(productId, { limit }));
            await priceExchange(items, req.exchangeRate);
            return res.success("RECORD_FOUND", items);
        } catch (error) {
            console.error("similarProducts", error);
            res.error(error);
        }
    },

    categoryThumbnails: async (req, res) => {
        try {
            if (!isMongoConnected() || isImageSearchBusy()) {
                return res.success("RECORD_FOUND", {});
            }

            const rawIds = String(req.query.ids || "")
                .split(",")
                .map((id) => id.trim())
                .filter(looksLikeObjectId);
            const refresh = String(req.query.refresh || "").trim();

            if (!rawIds.length) {
                return res.success("RECORD_FOUND", {});
            }

            const uniqueIds = [...new Set(rawIds)].slice(0, 32);
            const result = {};

            const thumbConcurrency = CATEGORY_THUMBNAIL_CONCURRENCY;
            await mapPool(uniqueIds, thumbConcurrency, async (categoryId) => {
                try {
                    const url = await withPromiseTimeout(
                        fetchCategoryThumbnailUrl(categoryId, refresh),
                        5000,
                        ""
                    );
                    if (url) result[categoryId] = url;
                } catch (err) {
                    console.warn(`categoryThumbnails failed for ${categoryId}:`, err.message);
                }
            });

            return res.success("RECORD_FOUND", result);
        } catch (error) {
            console.error(error);
            res.error(error);
        }
    },
};

