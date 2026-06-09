/**
 * Resolve a public HTTPS image URL from a product document (string or media ref).
 */
const resolveProductImageUrl = (product = {}) => {
    const candidates = [
        product.featured_image,
        ...(Array.isArray(product.images) ? product.images : []),
    ];

    for (const entry of candidates) {
        const url = typeof entry === "string"
            ? entry.trim()
            : String(entry?.link || "").trim();
        if (/^https?:\/\//i.test(url)) {
            return url;
        }
    }
    return null;
};

module.exports = { resolveProductImageUrl };
