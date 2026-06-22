const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const Product = require("../../../models/productsTable");
const ProductBehavior = require("../../../models/productBehaviorTable");
const { isMongoConnected } = require("../../../config/db");
const {
    expandCategoryFilterIds,
    buildMongoCategoryMatch,
} = require("./categoryFilterHelper");
const {
    applyEmbeddingBoost,
    getEmbeddingDiscoveryProducts,
} = require("./aiRecommendationService");
const { getPersonalizedSurface } = require("../../recommendations/services/recommendationEngineService");
const { publishRecommendationEvent } = require("../../recommendations/services/eventStreamService");

const DEFAULT_LIMIT = 24;
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

const getSeedNumber = (value = "") => {
    const input = String(value || "");
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash) + input.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
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
    const safeLimit = Math.max(Number(limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);
    const dayKey = new Date().toISOString().slice(0, 10);
    const offset = getSeedNumber(`${dayKey}:${seedKey}:${category || "all"}`) % 300;

    let products = await populateProductCards(
        Product.find(match)
            .sort({ date_created_utc: -1, _id: -1 })
            .skip(offset)
            .limit(safeLimit)
    );

    if (allowFill && products.length < safeLimit && offset > 0) {
        const fillProducts = await populateProductCards(
            Product.find(match)
                .sort({ date_created_utc: -1, _id: -1 })
                .limit(safeLimit - products.length)
        );
        const seen = new Set(products.map((product) => String(product._id)));
        products = [
            ...products,
            ...fillProducts.filter((product) => !seen.has(String(product._id))),
        ];
    }

    return dedupeProductList(products);
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

const getRotatedProductPage = async ({ limit, page = 1, skip, category = null, seedKey = "" } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 64));
    const safePage = resolveCatalogPage(page, skip);
    const poolSize = Math.min(280, safePage * safeLimit + safeLimit + 32);
    const pool = await getRotatedProducts({ limit: poolSize, category, seedKey });
    const start = (safePage - 1) * safeLimit;
    const items = pool.slice(start, start + safeLimit);
    const hasMore = start + safeLimit < pool.length;
    return {
        items,
        hasMore,
        total: hasMore ? start + items.length + 1 : start + items.length,
    };
};

/** Home / all-products listing: paginate the full active catalog (no capped pool). */
const getHomeBrowseProductPage = async ({ limit, page = 1, skip, seedKey = "" } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 100));
    const safePage = resolveCatalogPage(page, skip);
    const match = { status: "active" };
    const dayKey = new Date().toISOString().slice(0, 10);
    const baseOffset = getSeedNumber(`${dayKey}:${seedKey}:all`) % 300;
    const pageOffset = baseOffset + (safePage - 1) * safeLimit;

    let products = await populateProductCards(
        Product.find(match)
            .sort({ date_created_utc: -1, _id: -1 })
            .skip(pageOffset)
            .limit(safeLimit + 1)
    );

    const fetchedCount = products.length;
    products = dedupeProductList(products);
    const hasMore = fetchedCount > safeLimit;
    const items = products.slice(0, safeLimit);

    return {
        items,
        hasMore,
        total: hasMore ? pageOffset + items.length + 1 : pageOffset + items.length,
    };
};

const populateProductCards = (query) => query
    .select(productProjection)
    .populate({ path: "featured_image", select: "link -_id" })
    .lean();

const getPreferredCategoryIds = (behaviors = []) => {
    const scores = new Map();
    behaviors.forEach((behavior) => {
        const score = Number(behavior.score) || eventScores[behavior.eventType] || 1;
        (behavior.product?.categories || []).forEach((category) => {
            const key = String(category);
            scores.set(key, (scores.get(key) || 0) + score);
        });
    });
    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([categoryId]) => categoryId);
};

const getCandidateProducts = async ({ behaviors = [], limit = 250, category = null, seedKey = "" }) => {
    const preferredCategoryIds = category ? [category] : getPreferredCategoryIds(behaviors);
    const products = [];
    const seen = new Set();

    if (preferredCategoryIds.length) {
        const relatedOffset = getSeedNumber(`${seedKey}:${preferredCategoryIds.join(",")}`) % 60;
        const related = await populateProductCards(
            Product.find({
                status: "active",
                categories: { $in: preferredCategoryIds },
            })
                .sort({ average_rating: -1, sold_count: -1, date_created_utc: -1 })
                .skip(relatedOffset)
                .limit(limit)
        );
        related.forEach((product) => {
            const key = String(product._id);
            if (seen.has(key)) return;
            seen.add(key);
            products.push(product);
        });
    }

    if (products.length < limit) {
        const rotated = await getRotatedProducts({ limit: limit - products.length, category, seedKey });
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
        ) * 2.2;
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

const getRecommendedProducts = async (req, options = {}) => {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LIMIT, 100));
    const category = options.category || null;
    const engineEnabled = String(process.env.RECOMMENDATION_ENGINE_ENABLED ?? "true").toLowerCase() !== "false";

    if (engineEnabled && isMongoConnected() && !category) {
        try {
            const result = await getPersonalizedSurface("homepage_feed", req, { limit });
            if (result.items?.length) {
                return result.items.slice(0, limit);
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
            return discovered.slice(0, limit);
        }
        return rotatedProducts.slice(0, limit);
    }

    if (!usePythonRecommender()) {
        const ranked = scoreInNode(behaviors, rotatedProducts);
        const boosted = await applyEmbeddingBoost(ranked, behaviors);
        return boosted.slice(0, limit);
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
        return boosted.slice(0, limit);
    } catch (error) {
        console.warn("Python recommender unavailable, using Node fallback:", error.message);
        const ranked = scoreInNode(behaviors, rotatedProducts);
        const boosted = await applyEmbeddingBoost(ranked, behaviors);
        return boosted.slice(0, limit);
    }
};

module.exports = {
    trackProductBehavior,
    getRecommendedProducts,
    getRotatedProducts,
    getRotatedProductPage,
    getHomeBrowseProductPage,
    buildCatalogSeedKey,
};
