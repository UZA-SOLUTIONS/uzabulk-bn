const { isValidObjectId } = require("../../../validators/validator");
const { cosineSimilarity } = require("../../ai/services/embeddingService");
const { searchProductsByVector } = require("../../products/services/vectorSearchService");
const Order = require("../../../models/ordersTable");
const FAQ = require("../../../models/faqTable");
const tradePolicies = require("../knowledge/tradePolicies");
const { buildBuyerContextChunks, buildCartChunk } = require("./buyerContextService");
const { resolveProductChunksForQuery } = require("./productKnowledgeService");
const { withTimeout, isFastMode, retrievalTimeoutMs } = require("./buyerAssistantUtils");

const TOP_K = () => Number(process.env.BUYER_ASSISTANT_RAG_TOP_K || 6);

let faqCache = { at: 0, rows: [] };
const FAQ_TTL_MS = 5 * 60 * 1000;

const loadFaqs = async () => {
    if (Date.now() - faqCache.at < FAQ_TTL_MS && faqCache.rows.length) {
        return faqCache.rows;
    }
    faqCache.rows = await FAQ.find({ status: "active", type: { $in: ["customers", "website"] } })
        .select("question answer")
        .limit(isFastMode() ? 20 : 40)
        .lean();
    faqCache.at = Date.now();
    return faqCache.rows;
};

const extractOrderRef = (text = "") => {
    const sample = String(text || "");
    const patterns = [
        /\b(UZA[A-Z0-9]{6,})\b/i,
        /\b(TR[-\s]?\d{4}[-\s]?\d{3,})\b/i,
        /\border\s*#?\s*([A-Z0-9][-A-Z0-9]{4,})\b/i,
        /\b([a-f0-9]{24})\b/i,
    ];
    for (const re of patterns) {
        const match = sample.match(re);
        if (match?.[1]) return match[1].trim();
    }
    return "";
};

const scoreTextChunk = (query, chunkText, queryVector, chunkVector = null) => {
    const q = String(query || "").toLowerCase();
    const t = String(chunkText || "").toLowerCase();
    const tokens = q.split(/\s+/).filter((w) => w.length > 3);
    const keywordScore = tokens.length
        ? tokens.filter((tok) => t.includes(tok)).length / tokens.length
        : 0;
    const vectorScore = chunkVector && queryVector
        ? cosineSimilarity(queryVector, chunkVector)
        : 0;
    return keywordScore * 0.45 + vectorScore * 0.55;
};

const rankStaticChunks = (query, queryVector, chunks, limit) => {
    return chunks
        .map((chunk) => ({
            ...chunk,
            score: scoreTextChunk(query, `${chunk.title} ${chunk.text} ${(chunk.tags || []).join(" ")}`, queryVector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((row) => ({
            source: row.source,
            title: row.title,
            text: row.text,
            score: Number(row.score.toFixed(4)),
        }));
};

const fetchOrderForUser = async ({ orderRef, userId, deviceId }) => {
    if (!orderRef) return null;

    const orClauses = [
        { customOrderId: new RegExp(`^${orderRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { orderGroupId: orderRef },
        { "alibaba1688.third_order_id": orderRef },
        { "alibaba1688.primary_order_id": orderRef },
    ];

    if (isValidObjectId(orderRef)) {
        orClauses.push({ _id: orderRef });
    }

    const query = { $or: orClauses };
    if (userId) {
        query.user = userId;
    }

    let order = await Order.findOne(query).lean();
    if (!order && !userId && deviceId) {
        order = await Order.findOne({ $or: orClauses }).lean();
    }
    return order;
};

const buildOrderChunk = async (order) => {
    if (!order) return null;

    const lines = [
        `Order ID: ${order.customOrderId || order._id}`,
        `Status: ${order.orderStatus}`,
        `Payment: ${order.paymentStatus}`,
        `Total: ${order.orderTotal}`,
        `Items: ${order.totalItems || 0}`,
        `Created: ${order.date_created_utc || order.date_created || ""}`,
    ];

    const ali = order.alibaba1688 || {};
    if (ali.status) lines.push(`1688 status: ${ali.status}`);
    if (ali.primary_order_id) lines.push(`1688 order: ${ali.primary_order_id}`);

    if (Array.isArray(ali.logistics) && ali.logistics.length) {
        const latest = ali.logistics[0];
        lines.push(`Carrier: ${latest.company_name || "—"}`);
        lines.push(`Waybill: ${latest.waybill_number || "—"}`);
        lines.push(`Delivery status: ${latest.delivery_status || "—"}`);
        const lastEvent = (latest.trace_list || []).slice(-1)[0];
        if (lastEvent) {
            lines.push(`Last update: ${lastEvent.time} — ${lastEvent.status_desc || lastEvent.location}`);
        }
    }

    return {
        source: "order_history",
        title: `Order ${order.customOrderId || order._id}`,
        text: lines.join("\n"),
        score: 2,
        orderId: String(order._id),
    };
};

const fetchBuyerChunks = async ({ userId, deviceId }) => {
    if (userId) {
        return buildBuyerContextChunks({ userId, deviceId });
    }
    const cartChunk = await buildCartChunk({ userId: null, deviceId });
    return cartChunk ? [cartChunk] : [];
};

const retrieveKnowledge = async ({
    query,
    queryVector,
    userId,
    deviceId,
    productId,
    orderRef: explicitOrderRef,
    limit,
} = {}) => {
    const run = async () => {
        const effectiveLimit = limit || TOP_K();
        const orderRef = explicitOrderRef || extractOrderRef(query);
        const chunks = [];

        const vectorSearchFn = queryVector
            ? (vector, opts) => searchProductsByVector(vector, {}, opts)
            : null;

        const productLimit = isFastMode() ? 3 : 4;

        const [order, buyerChunks, productChunks, faqs] = await Promise.all([
            fetchOrderForUser({ orderRef, userId, deviceId }),
            fetchBuyerChunks({ userId, deviceId }),
            resolveProductChunksForQuery({
                query,
                queryVector,
                productId,
                vectorSearchFn,
                limit: productLimit,
            }),
            loadFaqs(),
        ]);

        const orderChunk = await buildOrderChunk(order);
        if (orderChunk) chunks.push(orderChunk);
        chunks.push(...buyerChunks);
        chunks.push(...productChunks);

        const policyChunks = rankStaticChunks(query, queryVector, tradePolicies, isFastMode() ? 2 : 3);
        chunks.push(...policyChunks);

        faqs
            .map((faq) => ({
                source: "trade_policies",
                title: faq.question,
                text: faq.answer,
                score: scoreTextChunk(query, `${faq.question} ${faq.answer}`, queryVector),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .forEach((row) => chunks.push(row));

        const deduped = [];
        const seen = new Set();
        for (const chunk of chunks.sort((a, b) => (b.score || 0) - (a.score || 0))) {
            const key = `${chunk.source}:${chunk.title}:${chunk.productId || ""}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(chunk);
            if (deduped.length >= effectiveLimit) break;
        }

        return {
            chunks: deduped,
            orderRef: orderRef || null,
            orderFound: Boolean(order),
            productId: productId || null,
            isLoggedIn: Boolean(userId),
        };
    };

    return withTimeout(run(), retrievalTimeoutMs(), {
        chunks: rankStaticChunks(query, queryVector, tradePolicies, 2),
        orderRef: explicitOrderRef || extractOrderRef(query) || null,
        orderFound: false,
        productId: productId || null,
        isLoggedIn: Boolean(userId),
    });
};

module.exports = {
    retrieveKnowledge,
    extractOrderRef,
    TOP_K,
};
