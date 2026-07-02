const Product = require("../../../models/productsTable");
const ProductBehavior = require("../../../models/productBehaviorTable");
const { isMongoConnected } = require("../../../config/db");
const { balanceCatalogProducts } = require("../../products/helpers/catalogVisibilityHelper");

const BROWSE_EVENTS = new Set(["view", "dwell", "page_view", "search"]);

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

const populateProductCards = (query) => query
    .select(productProjection)
    .populate({ path: "featured_image", select: "link -_id" })
    .lean();

const primaryCategoryId = (product) => {
    const cats = product?.categories || [];
    return cats.length ? String(cats[0]) : "__mixed__";
};

/**
 * Interleave ranked products so no single category dominates the feed.
 */
const diversifyByCategory = (products = [], {
    maxPerCategory = 3,
    limit = 48,
    excludeIds = null,
} = {}) => {
    const cap = Math.max(1, Number(limit) || 48);
    const maxPer = Math.max(1, Number(maxPerCategory) || 3);
    const excluded = excludeIds instanceof Set ? excludeIds : new Set();

    const filtered = (products || []).filter((product) => {
        const id = String(product?._id || "");
        return id && !excluded.has(id);
    });

    if (!filtered.length) return [];

    const buckets = new Map();
    filtered.forEach((product) => {
        const cat = primaryCategoryId(product);
        if (!buckets.has(cat)) buckets.set(cat, []);
        buckets.get(cat).push(product);
    });

    const iterators = [...buckets.entries()].map(([cat, items]) => ({ cat, items, idx: 0 }));
    const picked = [];
    const catCounts = new Map();
    const pickedIds = new Set();

    let progress = true;
    while (picked.length < cap && progress) {
        progress = false;
        iterators.sort((a, b) => a.idx - b.idx);
        for (const bucket of iterators) {
            if (picked.length >= cap) break;
            const count = catCounts.get(bucket.cat) || 0;
            if (count >= maxPer || bucket.idx >= bucket.items.length) continue;
            const product = bucket.items[bucket.idx];
            bucket.idx += 1;
            const id = String(product._id);
            if (pickedIds.has(id)) continue;
            picked.push(product);
            pickedIds.add(id);
            catCounts.set(bucket.cat, count + 1);
            progress = true;
        }
    }

    if (picked.length < cap) {
        filtered.forEach((product) => {
            if (picked.length >= cap) return;
            const id = String(product._id);
            if (pickedIds.has(id)) return;
            picked.push(product);
            pickedIds.add(id);
        });
    }

    return picked.slice(0, cap);
};

/**
 * Recently viewed products for the signed-in user (newest first).
 * Scoped to account user id only — syncs across devices when logged in.
 */
const getRecentBrowsedProducts = async (req, { limit = 12 } = {}) => {
    const userId = req?.user?._id;
    if (!userId || !isMongoConnected()) return [];

    const cap = Math.max(1, Math.min(Number(limit) || 12, 24));
    const behaviors = await ProductBehavior.find({
        user: userId,
        eventType: { $in: [...BROWSE_EVENTS] },
        product: { $exists: true, $ne: null },
    })
        .sort({ created_at: -1 })
        .limit(cap * 4)
        .select("product created_at eventType")
        .lean();

    const orderedIds = [];
    const seen = new Set();
    behaviors.forEach((row) => {
        const id = String(row.product || "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        orderedIds.push(id);
    });

    if (!orderedIds.length) return [];

    const rows = await populateProductCards(
        Product.find({ _id: { $in: orderedIds.slice(0, cap * 2) }, status: "active" })
    );
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    return balanceCatalogProducts(
        orderedIds
            .map((id) => byId.get(id))
            .filter(Boolean)
    ).slice(0, cap);
};

/** Remove browse history used for the recently-viewed row (per user account). */
const clearRecentBrowsedProducts = async (userId) => {
    const uid = String(userId || "").trim();
    if (!uid || !isMongoConnected()) return { deletedCount: 0 };

    const result = await ProductBehavior.deleteMany({
        user: uid,
        eventType: { $in: [...BROWSE_EVENTS] },
    });

    return { deletedCount: result?.deletedCount || 0 };
};

module.exports = {
    diversifyByCategory,
    getRecentBrowsedProducts,
    clearRecentBrowsedProducts,
    primaryCategoryId,
};
