const mongoose = require("mongoose");

const alibabaTokenSchema = new mongoose.Schema(
    {
        app_key: { type: String, required: true, trim: true, unique: true },
        access_token: { type: String, required: true },
        refresh_token: { type: String, default: "" },
        expires_at: { type: Date, default: null },
        refresh_expires_at: { type: Date, default: null },
        member_id: { type: String, default: "" },
        resource_owner: { type: String, default: "" },
        raw: { type: Object, default: null },
        last_refreshed_at: { type: Date, default: null },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const AlibabaToken = mongoose.model("AlibabaToken", alibabaTokenSchema);

AlibabaToken.getByAppKey = (appKey) =>
    AlibabaToken.findOne({ app_key: String(appKey) }).lean();

AlibabaToken.upsertToken = async (appKey, payload = {}) => {
    const now = Date.now();
    const expiresIn = Number(payload.expires_in || payload.expiresIn || 0);
    const refreshExpiresIn = Number(payload.re_expires_in || payload.refresh_token_timeout || 0);

    const doc = {
        app_key: String(appKey),
        access_token: payload.access_token || payload.accessToken || "",
        refresh_token: payload.refresh_token || payload.refreshToken || "",
        member_id: payload.member_id || payload.memberId || "",
        resource_owner: payload.resource_owner || payload.resourceOwner || "",
        raw: payload,
        last_refreshed_at: new Date(),
        expires_at: expiresIn > 0 ? new Date(now + expiresIn * 1000) : null,
        refresh_expires_at: refreshExpiresIn > 0 ? new Date(now + refreshExpiresIn * 1000) : null,
    };

    return AlibabaToken.findOneAndUpdate(
        { app_key: String(appKey) },
        { $set: doc },
        { upsert: true, new: true, lean: true }
    );
};

module.exports = AlibabaToken;
