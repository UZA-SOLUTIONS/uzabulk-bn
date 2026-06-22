const ProductBehavior = require("../../../models/productBehaviorTable");
const { isMongoConnected } = require("../../../config/db");

/**
 * Lightweight collaborative filtering from co-occurring product events.
 */
const scoreCollaborativeCandidates = async (seedProductIds = [], { limit = 80 } = {}) => {
    if (!isMongoConnected() || !seedProductIds.length) {
        return new Map();
    }

    const since = new Date(Date.now() - 30 * 86400000);
    const behaviors = await ProductBehavior.find({
        product: { $in: seedProductIds },
        created_at: { $gte: since },
    })
        .select("user deviceId product eventType score")
        .limit(2500)
        .lean();

    const sessions = new Map();
    behaviors.forEach((row) => {
        const sessionKey = String(row.user || row.deviceId || "");
        if (!sessionKey) return;
        if (!sessions.has(sessionKey)) sessions.set(sessionKey, new Set());
        if (row.product) sessions.get(sessionKey).add(String(row.product));
    });

    const seedSet = new Set(seedProductIds.map(String));
    const coScores = new Map();

    sessions.forEach((products) => {
        const list = [...products];
        const hasSeed = list.some((id) => seedSet.has(id));
        if (!hasSeed) return;

        list.forEach((productId) => {
            if (seedSet.has(productId)) return;
            coScores.set(productId, (coScores.get(productId) || 0) + 1);
        });
    });

    return new Map(
        [...coScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
    );
};

module.exports = {
    scoreCollaborativeCandidates,
};
