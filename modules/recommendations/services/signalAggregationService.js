const ProductBehavior = require("../../../models/productBehaviorTable");
const Order = require("../../../models/ordersTable");
const User = require("../../../models/userTable");
const Product = require("../../../models/productsTable");
const { isMongoConnected } = require("../../../config/db");

const INTENT_EVENTS = new Set(["add_to_cart", "update_cart", "checkout", "order"]);
const BROWSE_EVENTS = new Set(["view", "search"]);

const extractProductIdsFromLineItems = (lineItems = {}) => {
    const ids = [];
    const groups = Array.isArray(lineItems) ? lineItems : lineItems?.line_items || [];
    groups.forEach((group) => {
        (group?.items || []).forEach((item) => {
            const id = item?.product || item?.productId || item?._id;
            if (id) ids.push(String(id));
        });
    });
    return ids;
};

const median = (values = []) => {
    const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!nums.length) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

/**
 * Aggregate the five behavioral signal inputs for the recommendation engine.
 */
const aggregateUserSignals = async ({ userId, deviceId, country = "", city = "" } = {}) => {
    if (!isMongoConnected()) {
        return {
            browsing: {},
            transactions: {},
            preferences: {},
            regional: {},
            engagement: {},
            seedProductIds: [],
            preferredCategories: [],
            priceSensitivity: "medium",
            country: country || "",
            city: city || "",
        };
    }

    const identityOr = [];
    if (userId) identityOr.push({ user: userId });
    if (deviceId) identityOr.push({ deviceId });

    const [behaviors, orders, user] = await Promise.all([
        identityOr.length
            ? ProductBehavior.find({ $or: identityOr })
                .sort({ created_at: -1 })
                .limit(200)
                .populate({ path: "product", select: "name categories price supplier_id sellerOpenId" })
                .lean()
            : [],
        userId
            ? Order.find({
                user: userId,
                orderStatus: { $in: ["completed", "confirmed", "pending"] },
            })
                .sort({ date_created_utc: -1 })
                .limit(40)
                .select("line_items orderTotal date_created_utc")
                .lean()
            : [],
        userId ? User.findById(userId).select("country city").lean() : null,
    ]);

    const resolvedCountry = country || user?.country || "";
    const resolvedCity = city || user?.city || "";

    const pageViews = new Map();
    const dwellTimes = [];
    const scrollDepths = [];
    const searches = [];
    const filters = [];
    const categoryScores = new Map();
    const seedProductIds = [];
    const purchasedProductIds = [];
    const purchasePrices = [];
    const supplierScores = new Map();

    behaviors.forEach((row) => {
        const meta = row.metadata || {};
        if (meta.page) {
            pageViews.set(meta.page, (pageViews.get(meta.page) || 0) + 1);
        }
        if (meta.dwellTimeMs != null) dwellTimes.push(Number(meta.dwellTimeMs));
        if (meta.scrollDepth != null) scrollDepths.push(Number(meta.scrollDepth));
        if (row.search) searches.push(String(row.search));
        if (meta.filters) filters.push(meta.filters);
        if (meta.category) {
            const key = String(meta.category);
            categoryScores.set(key, (categoryScores.get(key) || 0) + (row.score || 1));
        }

        const productId = row.product?._id || row.product;
        if (productId && BROWSE_EVENTS.has(row.eventType)) {
            seedProductIds.push(String(productId));
        }
        if (productId && INTENT_EVENTS.has(row.eventType)) {
            seedProductIds.push(String(productId));
        }

        (row.product?.categories || []).forEach((catId) => {
            const key = String(catId);
            categoryScores.set(key, (categoryScores.get(key) || 0) + (row.score || 1));
        });

        const supplierKey = row.product?.supplier_id || row.product?.sellerOpenId;
        if (supplierKey) {
            supplierScores.set(String(supplierKey), (supplierScores.get(String(supplierKey)) || 0) + 1);
        }
    });

    orders.forEach((order) => {
        const ids = extractProductIdsFromLineItems(order.line_items);
        ids.forEach((id) => purchasedProductIds.push(id));
        if (order.orderTotal != null) purchasePrices.push(Number(order.orderTotal));
    });

    const preferredCategories = [...categoryScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);

    const preferredSuppliers = [...supplierScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, score]) => ({ supplierId: id, score }));

    const viewedPrices = behaviors
        .map((row) => Number(row.product?.price))
        .filter((price) => Number.isFinite(price) && price > 0);

    const avgViewedPrice = viewedPrices.length
        ? viewedPrices.reduce((sum, price) => sum + price, 0) / viewedPrices.length
        : null;
    const medianPurchase = median(purchasePrices);
    let priceSensitivity = "medium";
    if (medianPurchase != null && avgViewedPrice != null) {
        if (medianPurchase < avgViewedPrice * 0.75) priceSensitivity = "high";
        else if (medianPurchase > avgViewedPrice * 1.2) priceSensitivity = "low";
    }

    const uniqueSeeds = [...new Set([...seedProductIds, ...purchasedProductIds])].slice(0, 40);

    return {
        browsing: {
            pages: Object.fromEntries(pageViews),
            avgDwellTimeMs: dwellTimes.length
                ? Math.round(dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length)
                : 0,
            avgScrollDepth: scrollDepths.length
                ? Number((scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length).toFixed(3))
                : 0,
        },
        transactions: {
            orderCount: orders.length,
            repurchaseProductIds: [...new Set(purchasedProductIds)],
            medianOrderTotal: medianPurchase,
        },
        preferences: {
            savedCategories: preferredCategories,
            priceSensitivity,
            preferredSuppliers,
        },
        regional: {
            country: resolvedCountry,
            city: resolvedCity,
            demandCategories: preferredCategories.slice(0, 5),
        },
        engagement: {
            recentSearches: searches.slice(0, 12),
            recentFilters: filters.slice(0, 8),
            eventCount: behaviors.length,
        },
        seedProductIds: uniqueSeeds,
        preferredCategories,
        priceSensitivity,
        country: resolvedCountry,
        city: resolvedCity,
    };
};

/**
 * Regional demand: trending products in user's country/category mix.
 */
const loadRegionalDemandCandidates = async ({ country = "", categoryIds = [], limit = 40 } = {}) => {
    const query = { status: "active" };
    if (categoryIds.length) {
        query.categories = { $in: categoryIds };
    }

    const products = await Product.find(query)
        .select("name price categories supplier_id sellerOpenId sold_count average_rating")
        .sort({ sold_count: -1, average_rating: -1, date_created_utc: -1 })
        .limit(Math.max(limit, 20))
        .lean();

    return products.map((row) => ({
        ...row,
        regionalBoost: country ? 1.1 : 1,
    }));
};

module.exports = {
    aggregateUserSignals,
    loadRegionalDemandCandidates,
};
