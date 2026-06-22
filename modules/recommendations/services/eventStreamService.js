const RecommendationEvent = require("../../../models/recommendationEventTable");

const isRocketMqEnabled = () => {
    const flag = String(process.env.ROCKETMQ_ENABLED ?? "false").toLowerCase();
    return flag === "1" || flag === "true";
};

const buildIdentityKey = ({ userId, deviceId } = {}) => {
    const user = userId ? String(userId).trim() : "";
    const device = deviceId ? String(deviceId).trim() : "";
    return user || device || "guest";
};

const publishToRocketMq = async (payload) => {
    const webhook = String(process.env.ROCKETMQ_WEBHOOK_URL || "").trim();
    if (!webhook) {
        return { skipped: true, reason: "no_webhook" };
    }

    const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`RocketMQ webhook failed: ${response.status}`);
    }

    return { published: true };
};

/**
 * User events → RocketMQ stream (or Mongo event queue fallback).
 */
const publishRecommendationEvent = async ({
    userId = null,
    deviceId = "",
    eventType,
    productId = null,
    search = "",
    score = 1,
    metadata = {},
} = {}) => {
    if (!eventType) return null;

    const identityKey = buildIdentityKey({ userId, deviceId });
    const eventDoc = await RecommendationEvent.create({
        identityKey,
        user: userId || null,
        deviceId: deviceId || "",
        eventType,
        product: productId || null,
        search,
        score,
        metadata,
        publishedToMq: false,
    });

    const payload = {
        eventId: String(eventDoc._id),
        identityKey,
        userId: userId ? String(userId) : null,
        deviceId: deviceId || null,
        eventType,
        productId: productId ? String(productId) : null,
        search,
        score,
        metadata,
        ts: new Date().toISOString(),
    };

    if (isRocketMqEnabled()) {
        try {
            await publishToRocketMq(payload);
            await RecommendationEvent.updateOne(
                { _id: eventDoc._id },
                { $set: { publishedToMq: true } }
            );
        } catch (error) {
            console.warn("[recommendations] RocketMQ publish failed:", error.message);
        }
    }

    return eventDoc;
};

module.exports = {
    isRocketMqEnabled,
    buildIdentityKey,
    publishRecommendationEvent,
};
