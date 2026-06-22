const { getEmbedding, isDashscopeConfigured } = require("../../ai/services/embeddingService");

const buildUserProfileText = (signals = {}) => {
    const parts = [
        ...(signals.engagement?.recentSearches || []),
        ...(signals.preferences?.savedCategories || []).map((id) => `category ${id}`),
        signals.preferences?.priceSensitivity ? `price sensitivity ${signals.preferences.priceSensitivity}` : "",
        signals.regional?.country ? `country ${signals.regional.country}` : "",
        signals.regional?.city ? `city ${signals.regional.city}` : "",
        signals.browsing?.avgScrollDepth ? `scroll depth ${signals.browsing.avgScrollDepth}` : "",
        ...(signals.transactions?.repurchaseProductIds || []).slice(0, 8).map((id) => `purchased ${id}`),
    ].filter(Boolean);

    return parts.join(" ").slice(0, 4000);
};

/**
 * Qwen3-Embedding: build a user preference vector from aggregated signals.
 */
const buildUserEmbedding = async (signals = {}) => {
    if (!isDashscopeConfigured()) return null;

    const text = buildUserProfileText(signals);
    if (!text.trim()) return null;

    try {
        return await getEmbedding(text);
    } catch (error) {
        console.warn("[recommendations] user embedding failed:", error.message);
        return null;
    }
};

module.exports = {
    buildUserProfileText,
    buildUserEmbedding,
};
