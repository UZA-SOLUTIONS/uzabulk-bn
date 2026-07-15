const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const Product = require("../../../models/productsTable");
const ProductBehavior = require("../../../models/productBehaviorTable");
const { isMongoConnected } = require("../../../config/db");
const { withPromiseTimeout } = require("../../../utils/mongoQueryOptions");
const {
    getRotatedProducts,
    getPaginatedCatalogPage,
    dedupeProductList,
    populateProductCards,
    getSeedNumber,
    fetchUsableProducts,
} = require("./catalogRotationService");
const { balanceCatalogProducts, usableCatalogSort } = require("../helpers/catalogVisibilityHelper");
const {
    applyEmbeddingBoost,
    getEmbeddingDiscoveryProducts,
} = require("./aiRecommendationService");
const { getPersonalizedSurface } = require("../../recommendations/services/recommendationEngineService");
const { publishRecommendationEvent } = require("../../recommendations/services/eventStreamService");
const {
    diversifyByCategory,
    getRecentBrowsedProducts,
} = require("../../recommendations/services/feedMixService");

const DEFAULT_LIMIT = 24;
const PERSONALIZED_BROWSE_TIMEOUT_MS = Math.min(
    Math.max(Number(process.env.PERSONALIZED_BROWSE_TIMEOUT_MS || 6000), 2000),
    15000
);
/** Python subprocess budget; override with RECOMMENDER_PYTHON_TIMEOUT_MS (ms), clamped 1.2s–20s. */
const resolvePythonTimeoutMs = () => {
    const raw = parseInt(process.env.RECOMMENDER_PYTHON_TIMEOUT_MS || "", 10);
    if (Number.isFinite(raw)) {
        return Math.min(Math.max(raw, 1200), 20000);
    }
    return 4500;
};

const eventScores = {
    view: 1,
    search: 1,
    filter: 2,
    dwell: 1,
    page_view: 1,
    add_to_cart: 5,
    update_cart: 2,
    checkout: 7,
    order: 10,
};

/** Same weights as `ml/recommend_products.py` (applied × stored score × recency in scorer). */
const pythonEventWeights = {
    view: 1.0,
    search: 0.8,
    add_to_cart: 5.0,
    update_cart: 2.0,
    checkout: 7.0,
    order: 10.0,
};

const buyIntentEvents = new Set(["add_to_cart", "update_cart", "checkout", "order"]);

const getIdentityQuery = (req) => {
    const or = [];
    if (req?.user?._id) {
        or.push({ user: req.user._id });
    }
    const raw = req?.deviceId ?? req?.headers?.deviceid;
    const deviceId = raw != null && String(raw).trim() ? String(raw).trim() : "";
    if (deviceId) {
        or.push({ deviceId });
    }
    return or.length ? { $or: or } : null;
};

/** Mirrors `tokens()` in recommend_products.py */
const tokenizeForScore = (value) => {
    const text = String(value || "").toLowerCase();
    let spaced = "";
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        spaced += /[a-z0-9]/i.test(ch) ? ch : " ";
    }
    return spaced.split(/\s+/).filter((part) => part.length > 2);
};

/** Mirrors `recency_multiplier()` in recommend_products.py (7-day half-life). */
const recencyMultiplierForBehavior = (createdAt) => {
    if (!createdAt) return 1;
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return 1;
    const ageDays = Math.max((Date.now() - t) / 86400000, 0);
    return 1 / (1 + ageDays / 7);
};

const trackProductBehavior = async (req, {
    product,
    productId,
    offerId = "",
    eventType,
    search = "",
    score,
    metadata = {},
}) => {
    try {
        if (!isMongoConnected()) return;

        const resolvedProductId = product?._id || productId;
        if (!eventType) return;
        if (!resolvedProductId && eventType !== "search") return;

        const rawDevice = req?.deviceId ?? req?.headers?.deviceid;
        const deviceId = rawDevice != null ? String(rawDevice).trim() : "";

        await ProductBehavior.create({
            user: req?.user?._id || null,
            deviceId,
            product: resolvedProductId || null,
            offerId: offerId || product?.offerId || "",
            eventType,
            score: score || eventScores[eventType] || 1,
            search,
            metadata,
        });

        publishRecommendationEvent({
            userId: req?.user?._id || null,
            deviceId,
            eventType,
            productId: resolvedProductId || null,
            search,
            score: score || eventScores[eventType] || 1,
            metadata,
        }).catch((err) => {
            console.warn("Recommendation event publish failed:", err.message);
        });
    } catch (error) {
        console.warn("Product behavior tracking failed:", error.message);
    }
};

const buildCatalogSeedKey = (req, refresh = "") => {
    const rawDevice = req?.deviceId ?? req?.headers?.deviceid;
    const deviceId = rawDevice != null && String(rawDevice).trim() ? String(rawDevice).trim() : "";
    return [
        req?.user?._id || "",
        deviceId,
        refresh || "",
    ].filter(Boolean).join(":");
};

/** 1-based page index from API `?skip=` query (never Mongo `.skip()` offset). */
const resolveCatalogPage = (page, legacySkip) => {
    const fromPage = Number(page);
    if (Number.isFinite(fromPage) && fromPage >= 1) {
        return Math.floor(fromPage);
    }
    const fromSkip = Number(legacySkip);
    if (Number.isFinite(fromSkip) && fromSkip >= 1 && fromSkip <= 500) {
        return Math.floor(fromSkip);
    }
    return 1;
};

const getRotatedProductPage = async ({ limit, page = 1, skip, category = null, seedKey = "" } = {}) => (
    getPaginatedCatalogPage({
        limit,
        page: resolveCatalogPage(page, skip),
        category,
        seedKey,
    })
);

/** Home / all-products listing: paginate with seed-based rotation. */
const getHomeBrowseProductPage = async ({ limit, page = 1, skip, seedKey = "" } = {}) => (
    getRotatedProductPage({ limit, page, skip, seedKey, category: null })
);

const getPreferredCategoryIds = (behaviors = []) => {
    const scores = new Map();
    behaviors.forEach((behavior) => {
        const score = Number(behavior.score) || eventScores[behavior.eventType] || 1;
        const metaCategory = behavior.metadata?.category;
        if (metaCategory) {
            const key = String(metaCategory);
            scores.set(key, (scores.get(key) || 0) + score * 1.5);
        }
        (behavior.product?.categories || []).forEach((category) => {
            const key = String(category);
            scores.set(key, (scores.get(key) || 0) + score);
        });
    });
    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([categoryId]) => categoryId);
};

const getCandidateProducts = async ({ behaviors = [], limit = 250, category = null, seedKey = "" }) => {
    const preferredCategoryIds = category ? [category] : getPreferredCategoryIds(behaviors);
    const products = [];
    const seen = new Set();
    const preferredShare = category ? limit : Math.min(Math.floor(limit * 0.35), 40);

    if (preferredCategoryIds.length) {
        const relatedOffset = getSeedNumber(`${seedKey}:${preferredCategoryIds.join(",")}`) % 60;
        const related = balanceCatalogProducts(await populateProductCards(
            Product.find({
                status: "active",
                categories: { $in: preferredCategoryIds },
            })
                .sort({ average_rating: -1, sold_count: -1, date_created_utc: -1 })
                .skip(relatedOffset)
                .limit(preferredShare)
        ));
        related.forEach((product) => {
            const key = String(product._id);
            if (seen.has(key)) return;
            seen.add(key);
            products.push(product);
        });
    }

    if (products.length < limit) {
        const rotated = await getRotatedProducts({ limit: limit - products.length, category: null, seedKey });
        rotated.forEach((product) => {
            const key = String(product._id);
            if (seen.has(key)) return;
            seen.add(key);
            products.push(product);
        });
    }

    return products;
};

const resolvePythonBinary = () => {
    if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
    if (process.env.PYTHON) return process.env.PYTHON;
    return process.platform === "win32" ? "python" : "python3";
};

const runPythonRecommender = (payload) => new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "../ml/recommend_products.py");
    if (!fs.existsSync(scriptPath)) {
        reject(new Error(`Recommender script missing: ${scriptPath}`));
        return;
    }

    let body;
    try {
        body = JSON.stringify(payload);
    } catch (e) {
        reject(e);
        return;
    }

    const pythonBin = resolvePythonBinary();
    const child = spawn(pythonBin, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeoutMs = resolvePythonTimeoutMs();
    const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Python recommender timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });
    child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Cannot spawn Python (${pythonBin}): ${err.message}`));
    });
    child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
            reject(new Error(stderr.trim() || `Python recommender exited with code ${code}`));
            return;
        }
        try {
            const parsed = JSON.parse(stdout.trim() || "{}");
            if (!parsed || typeof parsed !== "object") {
                reject(new Error("Python recommender returned invalid JSON"));
                return;
            }
            resolve(parsed);
        } catch (error) {
            reject(new Error(`Python output not JSON: ${(stdout || "").slice(0, 200)}`));
        }
    });

    child.stdin.write(body);
    child.stdin.end();
});

/**
 * Same ranking signals as `ml/recommend_products.py` (search/name tokens, recency, ratings, sold).
 * Used when Python is missing, times out, or returns unusable output.
 */
const scoreInNode = (behaviors = [], candidates = []) => {
    const productScores = new Map();
    const categoryScores = new Map();
    const tokenScores = new Map();
    const seenProducts = new Set();
    const intentProducts = new Set();

    behaviors.forEach((behavior) => {
        const eventType = behavior.eventType;
        let weight = pythonEventWeights[eventType] ?? 1.0;
        weight *= Number(behavior.score) || 1;
        weight *= recencyMultiplierForBehavior(behavior.created_at);

        const productId = String(behavior.product?._id || behavior.product || "");
        if (productId) {
            productScores.set(productId, (productScores.get(productId) || 0) + weight);
            seenProducts.add(productId);
            if (buyIntentEvents.has(eventType)) {
                intentProducts.add(productId);
            }
        }

        (behavior.product?.categories || []).forEach((category) => {
            if (!category) return;
            const key = String(category);
            categoryScores.set(key, (categoryScores.get(key) || 0) + weight);
        });

        const name = behavior.product?.name || "";
        const search = behavior.search || "";
        tokenizeForScore(name).forEach((token) => {
            tokenScores.set(token, (tokenScores.get(token) || 0) + weight);
        });
        tokenizeForScore(search).forEach((token) => {
            tokenScores.set(token, (tokenScores.get(token) || 0) + weight);
        });
    });

    const scoreOne = (item, index) => {
        const candidateId = String(item._id || "");
        let score = 0;
        score += (productScores.get(candidateId) || 0)
            * (intentProducts.has(candidateId) ? 0.65 : 0.08);
        score += (item.categories || []).reduce(
            (sum, cat) => sum + (categoryScores.get(String(cat)) || 0),
            0
        ) * 0.9;
        score += tokenizeForScore(item.name).reduce(
            (sum, tok) => sum + (tokenScores.get(tok) || 0),
            0
        ) * 0.35;
        score += Math.min(Number(item.average_rating) || 0, 5) * 0.6;
        score += Math.log1p(Number(item.sold_count) || 0) * 0.15;
        if (seenProducts.has(candidateId) && !intentProducts.has(candidateId)) {
            score -= 3.0;
        }
        return { item, key: [score, -index] };
    };

    return [...candidates]
        .map((item, index) => scoreOne(item, index))
        .sort((a, b) => {
            if (b.key[0] !== a.key[0]) return b.key[0] - a.key[0];
            return b.key[1] - a.key[1];
        })
        .map((row) => row.item);
};

const mergeOrderedWithPool = (orderedIds, rotatedProducts, limit) => {
    const byId = new Map(rotatedProducts.map((product) => [String(product._id), product]));
    const idSet = new Set();
    const ordered = [];
    (orderedIds || []).forEach((rawId) => {
        const id = String(rawId || "");
        if (!id || idSet.has(id)) return;
        const doc = byId.get(id);
        if (!doc) return;
        idSet.add(id);
        ordered.push(doc);
    });
    rotatedProducts.forEach((product) => {
        const id = String(product._id);
        if (!idSet.has(id)) {
            idSet.add(id);
            ordered.push(product);
        }
    });
    return ordered.slice(0, limit);
};

const usePythonRecommender = () =>
    process.env.RECOMMENDER_USE_PYTHON === "1"
    || process.env.RECOMMENDER_USE_PYTHON === "true";

const finalizeHomeRecommendations = (products, limit) => (
    balanceCatalogProducts(diversifyByCategory(products, { maxPerCategory: 3, limit })).slice(0, limit)
);

const getRecommendedProducts = async (req, options = {}) => {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LIMIT, 100));
    const category = options.category || null;
    const engineEnabled = String(process.env.RECOMMENDATION_ENGINE_ENABLED ?? "true").toLowerCase() !== "false";

    if (engineEnabled && isMongoConnected() && !category) {
        try {
            const result = await getPersonalizedSurface("homepage_feed", req, {
                limit,
                contextKey: String(options.refresh || options.contextKey || "").slice(0, 80),
            });
            if (result.items?.length) {
                return balanceCatalogProducts(result.items).slice(0, limit);
            }
        } catch (error) {
            console.warn("Personalized homepage feed failed, using legacy recommender:", error.message);
        }
    }

    if (!isMongoConnected()) {
        return getRotatedProducts({
            limit,
            category,
            seedKey: String(options.refresh || req?.user?._id || req?.deviceId || "guest"),
        });
    }

    const identityQuery = getIdentityQuery(req);
    const behaviorLimit = Math.min(120, Math.max(24, limit * 3));
    const candidateLimit = Math.min(80, Math.max(limit * 2, limit + 16));

    const behaviors = identityQuery
        ? await ProductBehavior.find(identityQuery)
            .sort({ created_at: -1 })
            .limit(behaviorLimit)
            .populate({ path: "product", select: "name categories average_rating sold_count" })
            .lean()
        : [];

    const latestBehavior = behaviors[0];
    const seedKey = [
        req?.user?._id || "",
        req?.deviceId || req?.headers?.deviceid || "",
        latestBehavior?._id || "",
        latestBehavior?.created_at ? new Date(latestBehavior.created_at).getTime() : "",
        behaviors.length,
        options.refresh || "",
    ].filter(Boolean).join(":");

    const rotatedProducts = await getCandidateProducts({ behaviors, limit: candidateLimit, category, seedKey });
    if (!behaviors.length) {
        const discovered = await getEmbeddingDiscoveryProducts({ limit, seedKey });
        if (discovered.length) {
            return finalizeHomeRecommendations(discovered, limit);
        }
        return finalizeHomeRecommendations(rotatedProducts, limit);
    }

    if (!usePythonRecommender()) {
        const ranked = scoreInNode(behaviors, rotatedProducts);
        const boosted = await applyEmbeddingBoost(ranked, behaviors);
        return finalizeHomeRecommendations(boosted, limit);
    }

    const payload = {
        behaviors: behaviors.map((behavior) => ({
            product: String(behavior.product?._id || behavior.product || ""),
            eventType: behavior.eventType,
            score: behavior.score,
            search: behavior.search || "",
            name: behavior.product?.name || "",
            categories: behavior.product?.categories || [],
            createdAt: behavior.created_at,
        })),
        candidates: rotatedProducts.map((product) => ({
            _id: String(product._id),
            name: product.name,
            categories: product.categories || [],
            average_rating: product.average_rating,
            sold_count: product.sold_count,
            date_created_utc: product.date_created_utc,
        })),
    };

    try {
        const { orderedIds } = await runPythonRecommender(payload);
        const rawIds = Array.isArray(orderedIds) ? orderedIds : [];
        if (!rawIds.length) {
            throw new Error("Python recommender returned empty orderedIds");
        }
        const merged = mergeOrderedWithPool(rawIds, rotatedProducts, limit);
        const boosted = await applyEmbeddingBoost(merged, behaviors);
        return finalizeHomeRecommendations(boosted, limit);
    } catch (error) {
        console.warn("Python recommender unavailable, using Node fallback:", error.message);
        const ranked = scoreInNode(behaviors, rotatedProducts);
        const boosted = await applyEmbeddingBoost(ranked, behaviors);
        return finalizeHomeRecommendations(boosted, limit);
    }
};

const userHasBrowsingHistory = async (req) => {
    const identityQuery = getIdentityQuery(req);
    if (!identityQuery || !isMongoConnected()) return false;
    const row = await ProductBehavior.findOne(identityQuery).select("_id").lean();
    return Boolean(row);
};

const getPersonalizedProductPage = async (req, { limit, page = 1, skip, seedKey = "", refresh = "" } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 100));
    const safePage = resolveCatalogPage(page, skip);
    const compositeSeed = seedKey || `${buildCatalogSeedKey(req, refresh)}:browse`;
    const recentBrowsed = req?.user?._id
        ? await getRecentBrowsedProducts(req, { limit: 12 })
        : [];
    const recentIds = new Set(recentBrowsed.map((product) => String(product._id)));

    if (safePage > 1) {
        const pageResult = await getHomeBrowseProductPage({ limit: safeLimit, page: safePage, seedKey: compositeSeed });
        return { ...pageResult, recentBrowsed: [] };
    }

    const hasHistory = await userHasBrowsingHistory(req);
    if (!hasHistory) {
        const pageResult = await getHomeBrowseProductPage({ limit: safeLimit, page: safePage, seedKey: compositeSeed });
        return { ...pageResult, recentBrowsed };
    }

    const pool = await withPromiseTimeout(
        getRecommendedProducts(req, {
            limit: Math.min(80, safeLimit + 16),
            refresh: refresh || compositeSeed,
        }),
        PERSONALIZED_BROWSE_TIMEOUT_MS,
        null
    );

    if (Array.isArray(pool) && pool.length) {
        const mixed = balanceCatalogProducts(diversifyByCategory(
            pool.filter((product) => !recentIds.has(String(product._id))),
            { maxPerCategory: 3, limit: safeLimit }
        ));
        const items = mixed.slice(0, safeLimit);
        const hasMore = pool.length > safeLimit || mixed.length > safeLimit;
        return {
            items,
            hasMore,
            total: hasMore ? items.length + 1 : items.length,
            recentBrowsed,
        };
    }

    const pageResult = await getHomeBrowseProductPage({ limit: safeLimit, page: safePage, seedKey: compositeSeed });
    return { ...pageResult, recentBrowsed };
};

const HOT_DEALS_SORT = { sold_count: -1, average_rating: -1, date_created_utc: -1 };

const getTopInteractedProductIds = async ({ limit = 24 } = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 24, 64));
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const rows = await ProductBehavior.aggregate([
        {
            $match: {
                product: { $ne: null },
                created_at: { $gte: since },
                eventType: { $in: ["view", "search", "add_to_cart", "update_cart", "checkout", "order"] },
            },
        },
        {
            $group: {
                _id: "$product",
                score: { $sum: { $ifNull: ["$score", 1] } },
                events: { $sum: 1 },
            },
        },
        { $sort: { score: -1, events: -1 } },
        { $limit: cap },
    ]);
    return (rows || []).map((row) => row._id).filter(Boolean);
};

const mergeHotDealPools = ({ sold = [], interacted = [], recommended = [], limit = 12 } = {}) => {
    const cap = Math.max(1, Number(limit) || 12);
    const out = [];
    const seen = new Set();

    const pushUnique = (items = [], maxAdd = Infinity) => {
        let added = 0;
        for (const item of items) {
            if (out.length >= cap || added >= maxAdd) break;
            const id = String(item?._id || "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push(item);
            added += 1;
        }
    };

    // Highest sold first (~70%), then high-interaction / likely-to-visit last (~30%).
    const soldSorted = [...(sold || [])].sort(
        (a, b) => (Number(b?.sold_count) || 0) - (Number(a?.sold_count) || 0)
    );
    const soldSlots = Math.max(1, Math.ceil(cap * 0.7));
    pushUnique(soldSorted.filter((row) => Number(row?.sold_count) >= 1), soldSlots);
    pushUnique([...(recommended || []), ...(interacted || [])]);
    pushUnique(soldSorted);
    return out;
};

/**
 * Hot Deals: sold_count desc first, then most interacted / likely-to-visit.
 */
const getPersonalizedNewArrivalsPage = async (req, { limit, page = 1, skip } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 64));
    const safePage = resolveCatalogPage(page, skip);
    const offset = (safePage - 1) * safeLimit;
    const poolSize = Math.min(Math.max(safeLimit * 3, 36), 80);

    if (!isMongoConnected()) {
        return { items: [], hasMore: false, total: 0 };
    }

    const cardSelect = {
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
        min_order_qty: 1,
        sold_count: 1,
    };

    const loadByIds = async (ids = []) => {
        const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
        if (!unique.length) return [];
        const rows = await Product.find({ _id: { $in: unique }, status: "active" })
            .select(cardSelect)
            .populate({ path: "featured_image", select: "link -_id" })
            .lean();
        const byId = new Map(rows.map((row) => [String(row._id), row]));
        return unique.map((id) => byId.get(id)).filter(Boolean);
    };

    // Later pages keep walking sold ranking.
    if (safePage > 1) {
        const rows = await withPromiseTimeout(
            Product.find({ status: "active", sold_count: { $gte: 1 } })
                .sort(HOT_DEALS_SORT)
                .skip(offset)
                .limit(safeLimit + 8)
                .select(cardSelect)
                .populate({ path: "featured_image", select: "link -_id" })
                .lean(),
            8000,
            []
        );
        const usable = balanceCatalogProducts(rows || []);
        usable.sort((a, b) => (Number(b?.sold_count) || 0) - (Number(a?.sold_count) || 0));
        const items = usable.slice(0, safeLimit);
        return {
            items,
            hasMore: usable.length > safeLimit,
            total: offset + items.length + (usable.length > safeLimit ? 1 : 0),
        };
    }

    const [soldRows, interactedIds, recommendedRows] = await Promise.all([
        withPromiseTimeout(
            Product.find({ status: "active", sold_count: { $gte: 1 } })
                .sort(HOT_DEALS_SORT)
                .limit(poolSize)
                .select(cardSelect)
                .populate({ path: "featured_image", select: "link -_id" })
                .lean(),
            8000,
            []
        ),
        withPromiseTimeout(getTopInteractedProductIds({ limit: poolSize }), 4000, []),
        withPromiseTimeout(
            getRecommendedProducts(req, {
                limit: Math.min(poolSize, 24),
                refresh: req?.query?.refresh || "",
            }),
            5000,
            []
        ),
    ]);

    let sold = Array.isArray(soldRows) ? soldRows : [];
    if (!sold.length) {
        sold = await withPromiseTimeout(
            Product.find({ status: "active" })
                .sort(HOT_DEALS_SORT)
                .limit(poolSize)
                .select(cardSelect)
                .populate({ path: "featured_image", select: "link -_id" })
                .lean(),
            8000,
            []
        );
    }

    const interactedRows = await withPromiseTimeout(loadByIds(interactedIds), 4000, []);

    let merged = mergeHotDealPools({
        sold: [...(sold || [])],
        interacted: [...(interactedRows || [])],
        recommended: [...(recommendedRows || [])],
        limit: poolSize,
    });

    if (!merged.length) {
        const fallback = await withPromiseTimeout(
            getRotatedProductPage({
                limit: safeLimit + 4,
                page: 1,
                seedKey: buildCatalogSeedKey(req, req?.query?.refresh || "hot-deals"),
            }),
            5000,
            { items: [] }
        );
        merged = Array.isArray(fallback?.items) ? fallback.items : [];
    }

    const usable = balanceCatalogProducts(merged || []);
    const items = usable.slice(0, safeLimit);
    return {
        items,
        hasMore: usable.length > safeLimit,
        total: items.length + (usable.length > safeLimit ? 1 : 0),
    };
};

module.exports = {
    trackProductBehavior,
    getRecommendedProducts,
    getRotatedProducts,
    getRotatedProductPage,
    getHomeBrowseProductPage,
    getPersonalizedProductPage,
    getPersonalizedNewArrivalsPage,
    buildCatalogSeedKey,
    getRecentBrowsedProducts,
};
