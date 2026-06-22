const { priceExchange } = require("../../../helpers/helper");
const { isValidObjectId } = require("../../../validators/validator");
const {
    getPersonalizedSurface,
    getFastFallback,
    SURFACE_LIMITS,
    resolveIdentity,
} = require("../services/recommendationEngineService");
const { publishRecommendationEvent } = require("../services/eventStreamService");
const Cart = require("../../orders/services/cart");

const respondSurface = async (req, res, surface, options = {}) => {
    try {
        const limit = Math.min(
            Math.max(Number(req.query.limit) || options.limit || SURFACE_LIMITS[surface] || 12, 1),
            24
        );

        let result = await getPersonalizedSurface(surface, req, { ...options, limit });
        if (!result.items?.length) {
            const fallback = await getFastFallback(req, { limit });
            result = { ...result, items: fallback, cached: false, fallback: true };
        }

        await priceExchange(result.items, req.exchangeRate);
        return res.success(req.nextPageOptions(result.items, result.items.length, {
            surface,
            personalized: true,
            cached: result.cached,
            fallback: Boolean(result.fallback),
            abGroup: result.abGroup,
        }));
    } catch (error) {
        console.error(`recommendations.${surface}`, error);
        return res.error(error);
    }
};

module.exports = {
    homepageFeed: (req, res) => respondSurface(req, res, "homepage_feed"),

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

            return res.success("EVENT_RECORDED", { recorded: true });
        } catch (error) {
            console.error("recommendations.trackEngagement", error);
            return res.error(error);
        }
    },
};
