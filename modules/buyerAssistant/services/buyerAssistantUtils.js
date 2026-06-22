const withTimeout = (promise, ms, fallback = null) => {
    let timer;
    return Promise.race([
        promise,
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(fallback), ms);
        }),
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
};

const isFastMode = () =>
    String(process.env.BUYER_ASSISTANT_FAST_MODE ?? "true").toLowerCase() !== "false";

const embeddingsEnabled = () =>
    String(process.env.BUYER_ASSISTANT_EMBEDDINGS ?? "true").toLowerCase() !== "false";

const vectorSearchEnabled = () =>
    String(process.env.BUYER_ASSISTANT_VECTOR_SEARCH ?? "false").toLowerCase() === "true";

const embedTimeoutMs = () =>
    Math.min(Math.max(Number(process.env.BUYER_ASSISTANT_EMBED_TIMEOUT_MS || 3000), 1000), 8000);

const retrievalTimeoutMs = () =>
    Math.min(Math.max(Number(process.env.BUYER_ASSISTANT_RETRIEVAL_TIMEOUT_MS || 6000), 2000), 15000);

const needsProductSearch = (query, productId) => {
    if (productId) return true;

    const q = String(query || "").trim().toLowerCase();
    if (q.length < 3) return false;
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye|good\s*(morning|afternoon|evening))\b/.test(q)) {
        return false;
    }

    const accountOnly = /(my order|order status|track|cart|address|account|payment|profile|sign.?in|logged)/i.test(q);
    const productHint = /(product|price|moq|cost|buy|item|stock|wholesale|sku|offer|catalog|lamp|table|chair|phone|bag|shoe)/i.test(q);

    if (accountOnly && !productHint) return false;
    return productHint || q.split(/\s+/).filter((w) => w.length >= 3).length >= 2;
};

module.exports = {
    withTimeout,
    isFastMode,
    embeddingsEnabled,
    vectorSearchEnabled,
    embedTimeoutMs,
    retrievalTimeoutMs,
    needsProductSearch,
};
