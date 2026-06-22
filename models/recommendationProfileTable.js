const mongoose = require("mongoose");

const recommendationProfileSchema = new mongoose.Schema(
    {
        identityKey: { type: String, required: true, trim: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        deviceId: { type: String, default: "" },
        abGroup: { type: String, enum: ["control", "treatment"], default: "control" },
        embedding: { type: [Number], default: undefined },
        signals: {
            browsing: { type: Object, default: {} },
            transactions: { type: Object, default: {} },
            preferences: { type: Object, default: {} },
            regional: { type: Object, default: {} },
            engagement: { type: Object, default: {} },
        },
        preferredCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
        priceSensitivity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
        country: { type: String, default: "" },
        city: { type: String, default: "" },
        lastRefreshedAt: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
        versionKey: false,
    }
);

recommendationProfileSchema.index({ identityKey: 1 }, { unique: true, name: "recommendation_profile_identity" });
recommendationProfileSchema.index({ user: 1 }, { name: "recommendation_profile_user" });
recommendationProfileSchema.index({ deviceId: 1 }, { name: "recommendation_profile_device" });
recommendationProfileSchema.index({ lastRefreshedAt: 1 }, { name: "recommendation_profile_refresh" });

module.exports = mongoose.model("RecommendationProfile", recommendationProfileSchema);
