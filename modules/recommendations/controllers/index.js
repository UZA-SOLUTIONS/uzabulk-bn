const { priceExchange } = require("../../../helpers/helper");
const { isValidObjectId } = require("../../../validators/validator");
const {
    getPersonalizedSurface,
    getFastFallback,
    SURFACE_LIMITS,
    resolveIdentity,
} = require("../services/recommendationEngineService");
const { publishRecommendationEvent } = require("../services/eventStreamService");
const { trackProductBehavior } = require("../../products/services/recommendationService");
const { getRecentBrowsedProducts, clearRecentBrowsedProducts } = require("../services/feedMixService");
const { isMongoConnected } = require("../../../config/db");
const { withPromiseTimeout } = require("../../../utils/mongoQueryOptions");
const { isImageSearchBusy } = require("../../../utils/imageSearchGate");
const Cart = require("../../orders/services/cart");

const SURFACE_MONGO_BUDGET_MS = Math.min(
    Math.max(Number(process.env.RECOMMENDATION_SURFACE_BUDGET_MS || 12000), 3000),
    30000
);

const isMongoDegradedError = (error) => {
    const name = String(error?.name || "");
    const msg = String(error?.message || error || "").toLowerCase();
    return name === "MongoNetworkTimeoutError"
        || name === "MongoServerSelectionError"
        || name === "MongoPoolClearedError"
        || msg.includes("timed out")
        || msg.includes("time limit")
        || msg.includes("pool cleared");
};

const buildSurfacePayload = (req, items, total, extras = {}) => {
    const limit = Math.min(
        Math.max(Number(req.query.limit) || extras.limit || 12, 1),
        24
    );
    const skip = Number(req.query.skip) || 1;
    const safeTotal = Number(total) || 0;

    if (typeof req.nextPageOptions === "function") {
        return req.nextPageOptions(items, safeTotal, extras);
    }

    const { hasMore, ...othersMeta } = extras || {};
    return {
        total: safeTotal,
        items,
        skip,
        limit,
        totalPages: Math.ceil(safeTotal / limit) || 0,
        ...(typeof hasMore === "boolean" ? { hasMore } : {}),
        others: Object.keys(othersMeta).length ? othersMeta : null,
    };
};

const respondSurface = async (req, res, surface, options = {}) => {
    try {
        const limit = Math.min(
            Math.max(Number(req.query.limit) || options.limit || SURFACE_LIMITS[surface] || 12, 1),
            24
        );

        if (!isMongoConnected() || isImageSearchBusy()) {
            return res.success(buildSurfacePayload(req, [], 0, {
                surface,
                personalized: false,
                cached: false,
                fallback: true,
                mongoSkipped: true,
                imageSearchBusy: isImageSearchBusy(),
            }));
        }

        let result;
        let mongoDegraded = false;
        try {
            result = await withPromiseTimeout(
                getPersonalizedSurface(surface, req, { ...options, limit }),
                SURFACE_MONGO_BUDGET_MS,
                { items: [], cached: false, fallback: true, surface, timedOut: true }
            );
        } catch (surfaceError) {
            if (!isMongoDegradedError(surfaceError)) throw surfaceError;
            console.warn(`recommendations.${surface} degraded:`, surfaceError?.message || surfaceError);
            mongoDegraded = true;
            result = { items: [], cached: false, fallback: true, surface };
        }

        if (!result.items?.length && !mongoDegraded && !result.timedOut) {
            try {
                const fallback = await withPromiseTimeout(
                    getFastFallback(req, { limit }),
                    SURFACE_MONGO_BUDGET_MS,
                    []
                );
                result = { ...result, items: fallback, cached: false, fallback: true };
            } catch (fallbackError) {
                if (!isMongoDegradedError(fallbackError)) throw fallbackError;
                console.warn(`recommendations.${surface} fallback degraded:`, fallbackError?.message || fallbackError);
                mongoDegraded = true;
                result = { ...result, items: [], cached: false, fallback: true };
            }
        }

        try {
            await priceExchange(result.items, req.exchangeRate);
        } catch (exchangeError) {
            console.warn(`recommendations.${surface} price exchange failed:`, exchangeError?.message || exchangeError);
        }

        return res.success(buildSurfacePayload(req, result.items, result.items.length, {
            surface,
            personalized: Boolean(result.items.length),
            cached: result.cached,
            fallback: Boolean(result.fallback),
            abGroup: result.abGroup,
            ...(mongoDegraded || result.timedOut ? { mongoDegraded: true } : {}),
        }));
    } catch (error) {
        if (isMongoDegradedError(error)) {
            console.warn(`recommendations.${surface} degraded:`, error?.message || error);
            return res.success(buildSurfacePayload(req, [], 0, {
                surface,
                personalized: false,
                cached: false,
                fallback: true,
                mongoDegraded: true,
            }));
        }
        console.error(`recommendations.${surface}`, error);
        return res.error(error);
    }
};

module.exports = {
    homepageFeed: (req, res) => respondSurface(req, res, "homepage_feed"),

    recentlyViewed: async (req, res) => {
        try {
            const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 24);
            if (!req?.user?._id) {
                return res.error({ message: "NOT_AUTHORIZED", code: 401 });
            }
            if (!isMongoConnected()) {
                return res.success(buildSurfacePayload(req, [], 0, {
                    surface: "recently_viewed",
                    personalized: false,
                }));
            }

            const items = await withPromiseTimeout(
                getRecentBrowsedProducts(req, { limit }),
                SURFACE_MONGO_BUDGET_MS,
                []
            );

            try {
                await priceExchange(items, req.exchangeRate);
            } catch (exchangeError) {
                console.warn("recommendations.recentlyViewed price exchange failed:", exchangeError?.message || exchangeError);
            }

            return res.success(buildSurfacePayload(req, items, items.length, {
                surface: "recently_viewed",
                personalized: Boolean(items.length),
            }));
        } catch (error) {
            console.error("recommendations.recentlyViewed", error);
            return res.error(error);
        }
    },

    clearRecentlyViewed: async (req, res) => {
        try {
            if (!req?.user?._id) {
                return res.error({ message: "NOT_AUTHORIZED", code: 401 });
            }

            const result = await clearRecentBrowsedProducts(req.user._id);
            return res.success("RECENTLY_VIEWED_CLEARED", result);
        } catch (error) {
            console.error("recommendations.clearRecentlyViewed", error);
            return res.error(error);
        }
    },

    similarProducts: async (req, res) => {
        const productId = req.params.productId;
        if (!isValidObjectId(productId)) {
            return res.error("INVALID_PRODUCT_ID");
        }
        return respondSurface(req, res, "similar_products", {
            sourceProductId: productId,
            contextKey: String(productId),
            limit: 6,
        });
    },

    crossSell: async (req, res) => {
        try {
            const cartIds = String(req.query.cart_ids || "")
                .split(",")
                .map((id) => id.trim())
                .filter(isValidObjectId);

            let cartProductIds = [];
            if (cartIds.length) {
                const user = req.user;
                const query = user?._id
                    ? { _id: { $in: cartIds }, user: user._id }
                    : { _id: { $in: cartIds }, deviceId: req.deviceId, cartType: "temp" };
                const carts = await Cart.cartList(query);
                carts.forEach((cart) => {
                    (cart.items || []).forEach((item) => {
                        if (item?.product) cartProductIds.push(String(item.product));
                    });
                });
            }

            return respondSurface(req, res, "cross_sell", {
                cartProductIds,
                contextKey: cartProductIds.slice(0, 5).join(":") || "empty",
                limit: 4,
            });
        } catch (error) {
            console.error("recommendations.crossSell", error);
            return res.error(error);
        }
    },

    emailDigest: (req, res) => respondSurface(req, res, "email_digest", { limit: 5 }),

    supplierHighlights: (req, res) => respondSurface(req, res, "supplier_highlights", { limit: 8 }),

    /** Client-side behavioral signals (dwell time, scroll depth, filters). */
    trackEngagement: async (req, res) => {
        try {
            if (!isMongoConnected()) {
                return res.success("EVENT_RECORDED", { recorded: false, skipped: true });
            }

            const {
                eventType = "view",
                productId,
                search = "",
                page = "",
                dwellTimeMs,
                scrollDepth,
                filters,
                category,
                country,
                city,
            } = req.body || {};

            const { userId, deviceId } = resolveIdentity(req);
            await publishRecommendationEvent({
                userId: userId || null,
                deviceId,
                eventType,
                productId,
                search,
                score: 1,
                metadata: {
                    page,
                    dwellTimeMs,
                    scrollDepth,
                    filters,
                    category,
                    country,
                    city,
                    client: true,
                },
            });

            const shouldPersistBehavior = req?.user?._id
                || !(productId && ["view", "dwell", "page_view"].includes(eventType));

            if (shouldPersistBehavior) {
                void trackProductBehavior(req, {
                    productId,
                    eventType,
                    search,
                    metadata: {
                        page,
                        dwellTimeMs,
                        scrollDepth,
                        filters,
                        category,
                        country,
                        city,
                        client: true,
                    },
                }).catch((err) => {
                    console.warn("trackProductBehavior from engagement failed:", err?.message);
                });
            }

            return res.success("EVENT_RECORDED", { recorded: true });
        } catch (error) {
            console.error("recommendations.trackEngagement", error);
            return res.error(error);
        }
    },
};
