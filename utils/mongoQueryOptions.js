const clamp = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

/** Off by default — set MONGO_QUERY_MAX_TIME_MS only when you want server-side query caps. */
const getMongoMaxTimeMS = () => {
    const raw = process.env.MONGO_QUERY_MAX_TIME_MS;
    if (raw === undefined || raw === "" || raw === "0" || String(raw).toLowerCase() === "false") {
        return 0;
    }
    return clamp(raw, 5000, 120000, 30000);
};

const withMongoMaxTime = (query) => {
    const ms = getMongoMaxTimeMS();
    if (!ms || !query || typeof query.maxTimeMS !== "function") return query;
    return query.maxTimeMS(ms);
};

const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

/**
 * Populate featured_image only when the ref is a valid ObjectId.
 * Stubs / 1688 rows often store a direct image URL — populate would cast that as _id and throw.
 */
const safePopulateFeaturedImage = async (ProductModel, items = []) => {
    if (!Array.isArray(items) || !items.length) return items;

    const needsPopulate = items.filter((item) => {
        const ref = item?.featured_image;
        return looksLikeObjectId(ref);
    });

    if (!needsPopulate.length) {
        items.forEach((item) => {
            const img = item?.featured_image;
            if (img && typeof img === "string" && !looksLikeObjectId(img)) {
                item.featured_image = img;
            }
        });
        return items;
    }

    try {
        await ProductModel.populate(needsPopulate, { path: "featured_image", select: "link -_id" });
    } catch (error) {
        console.warn("featured_image populate skipped:", error?.message || error);
    }

    items.forEach((item) => {
        const img = item?.featured_image;
        if (img && typeof img === "object" && img.link) {
            item.featured_image = img.link;
        }
    });

    return items;
};

const withPromiseTimeout = async (promise, timeoutMs, fallback = null) => {
    const ms = Number(timeoutMs);
    if (!Number.isFinite(ms) || ms <= 0) {
        return promise;
    }

    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

module.exports = {
    getMongoMaxTimeMS,
    withMongoMaxTime,
    looksLikeObjectId,
    safePopulateFeaturedImage,
    withPromiseTimeout,
};
