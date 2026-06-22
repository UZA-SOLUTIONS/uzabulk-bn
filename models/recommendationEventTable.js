const mongoose = require("mongoose");

const recommendationEventSchema = new mongoose.Schema(
    {
        identityKey: { type: String, required: true, trim: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        deviceId: { type: String, default: "" },
        eventType: { type: String, required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        search: { type: String, default: "" },
        score: { type: Number, default: 1 },
        metadata: { type: Object, default: {} },
        publishedToMq: { type: Boolean, default: false },
        processedAt: { type: Date, default: null },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
        versionKey: false,
    }
);

recommendationEventSchema.index({ identityKey: 1, created_at: -1 }, { name: "recommendation_event_identity" });
recommendationEventSchema.index({ publishedToMq: 1, created_at: 1 }, { name: "recommendation_event_queue" });

module.exports = mongoose.model("RecommendationEvent", recommendationEventSchema);
