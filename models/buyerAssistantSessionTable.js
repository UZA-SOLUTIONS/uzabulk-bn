const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ["user", "assistant", "system"], required: true },
        content: { type: String, default: "" },
        language: { type: String, default: "en" },
        dispute_flag: { type: Boolean, default: false },
        status: { type: String, default: "ok" },
        metadata: { type: Object, default: {} },
        date_created_utc: { type: Date, default: Date.now },
    },
    { _id: false }
);

const buyerAssistantSessionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        deviceId: { type: String, default: "" },
        language: { type: String, default: "en" },
        dispute_flag: { type: Boolean, default: false },
        escalated: { type: Boolean, default: false },
        messages: { type: [messageSchema], default: [] },
        context: { type: Object, default: {} },
        date_created_utc: { type: Date, default: Date.now },
        date_modified_utc: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

buyerAssistantSessionSchema.index({ user: 1, date_modified_utc: -1 });
buyerAssistantSessionSchema.index({ deviceId: 1, date_modified_utc: -1 });

module.exports = mongoose.model("BuyerAssistantSession", buyerAssistantSessionSchema);
