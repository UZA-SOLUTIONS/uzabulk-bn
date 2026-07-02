const Product = require("../../../models/productsTable");
const RecommendationProfile = require("../../../models/recommendationProfileTable");
const { RecommendationCache } = require("../../../models/recommendationCacheTable");
const { isMongoConnected } = require("../../../config/db");
const { buildIdentityKey } = require("./eventStreamService");
const { assignAbGroup } = require("./abTestService");
const { aggregateUserSignals, loadRegionalDemandCandidates } = require("./signalAggregationService");
const { buildUserEmbedding } = require("./userEmbeddingService");
const { scoreCollaborativeCandidates } = require("./collaborativeFilterService");
const { rankCandidates } = require("./personalizedRankingService");
const { getSimilarProducts } = require("../../products/services/similarProductsService");
const { getEmbeddingDiscoveryProducts } = require("../../products/services/aiRecommendationService");
const { getRotatedProducts } = require("../../products/services/catalogRotationService");
const { balanceCatalogProducts } = require("../../products/helpers/catalogVisibilityHelper");
const { cosineSimilarity } = require("../../ai/services/embeddingService");
const { diversifyByCategory } = require("./feedMixService");

const SURFACE_LIMITS = {
    homepage_feed: 12,
    similar_products: 6,
    cross_sell: 4,
    email_digest: 5,
    supplier_highlights: 8,
};

const SURFACE_TTL_MS = {
    homepage_feed: Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 15 * 60 * 1000),
    similar_products: Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 15 * 60 * 1000),
    cross_sell: Number(process.env.RECOMMENDATION_CROSS_SELL_TTL_MS || 5 * 60 * 1000),
    email_digest: Number(process.env.RECOMMENDATION_EMAIL_TTL_MS || 7 * 24 * 60 * 60 * 1000),
    supplier_highlights: Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 15 * 60 * 1000),
};

const productCardProjection = {
    name: 1,
    price: 1,
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
    bestSeller: 1,
    date_created_utc: 1,
    featureAttribute: 1,
    offerId: 1,
    categories: 1,
    sold_count: 1,
    embedding: 1,
    supplier_id: 1,
    sellerOpenId: 1,
    supplier_rating: 1,
};

const resolveIdentity = (req = {}) => {
    const userId = req?.user?._id ? String(req.user._id) : "";
    const rawDevice = req?.deviceId ?? req?.headers?.deviceid;
    const deviceId = rawDevice != null ? String(rawDevice).trim() : "";
    const identityKey = buildIdentityKey({ userId, deviceId });
    return { userId, deviceId, identityKey };
};

const populateCards = (query) => query
    .select(productCardProjection)
    .populate({ path: "featured_image", select: "link -_id" })
    .lean();

const loadProductsByIds = async (ids = []) => {
    if (!ids.length) return [];
    const rows = await populateCards(Product.find({ _id: { $in: ids }, status: "active" }));
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
};

const readCache = async (identityKey, surface, contextKey = "") => {
    const row = await RecommendationCache.findOne({
        identityKey,
        surface,
        contextKey: contextKey || "",
        expiresAt: { $gt: new Date() },
    }).lean();
    return row || null;
};

const writeCache = async ({
    identityKey,
    surface,
    contextKey = "",
    productIds = [],
    supplierIds = [],
    scores = [],
    meta = {},
}) => {
    const ttl = SURFACE_TTL_MS[surface] || SURFACE_TTL_MS.homepage_feed;
    const expiresAt = new Date(Date.now() + ttl);

    await RecommendationCache.findOneAndUpdate(
        { identityKey, surface, contextKey: contextKey || "" },
        {
            $set: {
                productIds,
                supplierIds,
                scores,
                meta,
                expiresAt,
            },
        },
        { upsert: true, new: true }
    );
};

const buildCandidatePool = async (signals = {}, { limit = 80, cartProductIds = [] } = {}) => {
    const seedIds = [...new Set([
        ...(signals.seedProductIds || []),
        ...cartProductIds,
    ])].slice(0, 30);

    const preferredCats = (signals.preferredCategories || []).slice(0, 4);
    const relatedLimit = Math.min(Math.floor(limit * 0.35), 28);

    const [coScores, regional, related, diverse] = await Promise.all([
        scoreCollaborativeCandidates(seedIds, { limit }),
        loadRegionalDemandCandidates({
            country: signals.country,
            categoryIds: preferredCats,
            limit: Math.min(limit, 40),
        }),
        preferredCats.length
            ? populateCards(Product.find({
                status: "active",
                categories: { $in: preferredCats },
            })
                .sort({ sold_count: -1, average_rating: -1 })
                .limit(relatedLimit))
            : [],
        getRotatedProducts({
            limit: Math.max(limit - relatedLimit, Math.floor(limit * 0.5)),
            seedKey: signals.identityKey || "guest",
        }),
    ]);

    const merged = new Map();
    [...regional, ...related, ...diverse].forEach((row) => {
        merged.set(String(row._id), row);
    });

    if (signals.userEmbedding) {
        const catalog = await populateCards(
            Product.find({
                status: "active",
                embedding: { $exists: true, $type: "array", $ne: [] },
            })
                .limit(Math.min(limit * 2, 120))
        );
        catalog
            .map((row) => ({
                row,
                score: cosineSimilarity(signals.userEmbedding, row.embedding),
            }))
            .filter((entry) => entry.score > 0.12)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .forEach((entry) => merged.set(String(entry.row._id), entry.row));
    }

    coScores.forEach((score, productId) => {
        if (merged.has(productId)) return;
    });

    const missingCoIds = [...coScores.keys()].filter((id) => !merged.has(id)).slice(0, 24);
    if (missingCoIds.length) {
        const coProducts = await populateCards(
            Product.find({ _id: { $in: missingCoIds }, status: "active" })
        );
        coProducts.forEach((row) => merged.set(String(row._id), row));
    }

    if (!merged.size) {
        const rotated = await getRotatedProducts({ limit, seedKey: signals.identityKey || "guest" });
        rotated.forEach((row) => merged.set(String(row._id), row));
    }

    return {
        candidates: balanceCatalogProducts([...merged.values()]).slice(0, limit),
        coScores,
    };
};

const refreshUserProfile = async ({ userId, deviceId, identityKey, country = "", city = "" } = {}) => {
    const signals = await aggregateUserSignals({ userId, deviceId, country, city });
    const userEmbedding = await buildUserEmbedding(signals);
    const abGroup = assignAbGroup(identityKey);

    const profile = await RecommendationProfile.findOneAndUpdate(
        { identityKey },
        {
            $set: {
                user: userId || null,
                deviceId: deviceId || "",
                abGroup,
                embedding: userEmbedding || undefined,
                signals: {
                    browsing: signals.browsing,
                    transactions: signals.transactions,
                    preferences: signals.preferences,
                    regional: signals.regional,
                    engagement: signals.engagement,
                    seedProductIds: signals.seedProductIds,
                },
                preferredCategories: signals.preferredCategories,
                priceSensitivity: signals.priceSensitivity,
                country: signals.country,
                city: signals.city,
                lastRefreshedAt: new Date(),
            },
        },
        { upsert: true, new: true }
    ).lean();

    return {
        profile,
        signals: {
            ...signals,
            userEmbedding,
            abGroup,
            identityKey,
        },
    };
};

const computeSurface = async (surface, req, {
    contextKey = "",
    cartProductIds = [],
    sourceProductId = null,
    limit,
} = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || SURFACE_LIMITS[surface] || 12, 24));
    const { userId, deviceId, identityKey } = resolveIdentity(req);

    let profile = await RecommendationProfile.findOne({ identityKey }).lean();
    if (!profile || !profile.lastRefreshedAt) {
        const refreshed = await refreshUserProfile({
            userId,
            deviceId,
            identityKey,
            country: req?.user?.country || "",
            city: req?.user?.city || "",
        });
        profile = refreshed.profile;
    }

    const signals = {
        ...(profile?.signals || {}),
        preferredCategories: profile?.preferredCategories || [],
        priceSensitivity: profile?.priceSensitivity || "medium",
        country: profile?.country || "",
        city: profile?.city || "",
        seedProductIds: profile?.signals?.seedProductIds || profile?.signals?.transactions?.repurchaseProductIds || [],
        userEmbedding: profile?.embedding || null,
        engagement: profile?.signals?.engagement || {},
        transactions: profile?.signals?.transactions || {},
        identityKey,
    };

    if (surface === "similar_products" && sourceProductId) {
        const similar = await getSimilarProducts(sourceProductId, { limit: cap });
        await writeCache({
            identityKey,
            surface,
            contextKey: String(sourceProductId),
            productIds: similar.map((row) => row._id),
            meta: { sourceProductId: String(sourceProductId) },
        });
        return similar;
    }

    const { candidates, coScores } = await buildCandidatePool(signals, {
        limit: Math.max(cap * 4, 40),
        cartProductIds,
    });

    const ranked = await rankCandidates(candidates, {
        userEmbedding: signals.userEmbedding,
        signals,
        coScores,
        abGroup: profile?.abGroup || "control",
        surface,
    });

    let output = balanceCatalogProducts(diversifyByCategory(ranked, {
        maxPerCategory: surface === "homepage_feed" ? 2 : 3,
        limit: cap,
    }));

    if (surface === "supplier_highlights") {
        const supplierMap = new Map();
        ranked.forEach((row) => {
            const key = row.supplier_id || row.sellerOpenId;
            if (!key || supplierMap.has(key)) return;
            supplierMap.set(key, row);
        });
        output = [...supplierMap.values()].slice(0, cap);
        await writeCache({
            identityKey,
            surface,
            contextKey,
            productIds: output.map((row) => row._id),
            supplierIds: [...supplierMap.keys()],
            meta: { abGroup: profile?.abGroup },
        });
        return output;
    }

    await writeCache({
        identityKey,
        surface,
        contextKey,
        productIds: output.map((row) => row._id),
        meta: { abGroup: profile?.abGroup },
    });

    return output;
};

/**
 * Serve recommendations from cache (<100ms). Recompute in background on miss.
 */
const getPersonalizedSurface = async (surface, req, options = {}) => {
    const cap = Math.max(1, Math.min(Number(options.limit) || SURFACE_LIMITS[surface] || 12, 24));
    const { identityKey } = resolveIdentity(req);
    const contextKey = String(options.contextKey || options.sourceProductId || "").trim();

    if (isMongoConnected()) {
        const cached = await readCache(identityKey, surface, contextKey);
        if (cached?.productIds?.length) {
            const items = balanceCatalogProducts(await loadProductsByIds(cached.productIds));
            if (items.length) {
                return {
                    items: items.slice(0, cap),
                    cached: true,
                    abGroup: cached.meta?.abGroup || null,
                    surface,
                };
            }
        }
    }

    const items = await computeSurface(surface, req, {
        ...options,
        limit: cap,
        contextKey,
    });

    return {
        items,
        cached: false,
        abGroup: null,
        surface,
    };
};

const getFastFallback = async (req, { limit = 12 } = {}) => {
    const { identityKey } = resolveIdentity(req);
    const discovered = await getEmbeddingDiscoveryProducts({ limit, seedKey: identityKey });
    if (discovered.length) return discovered;
    return getRotatedProducts({ limit, seedKey: identityKey });
};

const refreshAllSurfacesForIdentity = async (req) => {
    const surfaces = ["homepage_feed", "email_digest", "supplier_highlights"];
    const results = {};
    for (const surface of surfaces) {
        try {
            results[surface] = await computeSurface(surface, req, {
                limit: SURFACE_LIMITS[surface],
            });
        } catch (error) {
            results[surface] = { error: error.message };
        }
    }
    return results;
};

const refreshStaleProfiles = async ({ limit = 50 } = {}) => {
    const staleBefore = new Date(Date.now() - Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 15 * 60 * 1000));
    const profiles = await RecommendationProfile.find({
        $or: [
            { lastRefreshedAt: { $lt: staleBefore } },
            { lastRefreshedAt: { $exists: false } },
            { lastRefreshedAt: null },
        ],
    })
        .sort({ lastRefreshedAt: 1 })
        .limit(Math.max(1, Math.min(limit, 200)))
        .lean();

    let processed = 0;
    for (const profile of profiles) {
        try {
            const req = {
                user: profile.user ? { _id: profile.user, country: profile.country, city: profile.city } : null,
                deviceId: profile.deviceId,
            };
            await refreshUserProfile({
                userId: profile.user,
                deviceId: profile.deviceId,
                identityKey: profile.identityKey,
                country: profile.country,
                city: profile.city,
            });
            await refreshAllSurfacesForIdentity(req);
            processed += 1;
        } catch (error) {
            console.warn(`[recommendations] refresh failed ${profile.identityKey}:`, error.message);
        }
    }

    return { processed, scanned: profiles.length };
};

module.exports = {
    SURFACE_LIMITS,
    resolveIdentity,
    getPersonalizedSurface,
    getFastFallback,
    refreshUserProfile,
    refreshAllSurfacesForIdentity,
    refreshStaleProfiles,
    computeSurface,
};
