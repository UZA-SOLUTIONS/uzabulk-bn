const mongoose = require("mongoose");

const SURFACES = [
    "homepage_feed",
    "similar_products",
    "cross_sell",
    "email_digest",
    "supplier_highlights",
];

const recommendationCacheSchema = new mongoose.Schema(
    {
        identityKey: { type: String, required: true, trim: true },
        surface: { type: String, enum: SURFACES, required: true },
        contextKey: { type: String, default: "" },
        productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        supplierIds: [{ type: String }],
        scores: [{ productId: mongoose.Schema.Types.ObjectId, score: Number }],
        meta: { type: Object, default: {} },
        expiresAt: { type: Date, required: true },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
        versionKey: false,
    }
);

recommendationCacheSchema.index(
    { identityKey: 1, surface: 1, contextKey: 1 },
    { unique: true, name: "recommendation_cache_lookup" }
);
recommendationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "recommendation_cache_ttl" });

module.exports = {
    RecommendationCache: mongoose.model("RecommendationCache", recommendationCacheSchema),
    RECOMMENDATION_SURFACES: SURFACES,
};
