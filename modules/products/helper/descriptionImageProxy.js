const axios = require("axios");

const ALLOWED_HOST_RE = /^(?:[a-z0-9-]+\.)*(?:alicdn\.com|alibaba\.com|1688\.com)$/i;
const EXTERNAL_IMAGE_HOST_RE = /alicdn\.com|alibaba\.com|1688\.com/i;
const PROXIED_DESCRIPTION_IMAGE_RE = /\/products\/description-image(?:\/|\?url=)/i;

const normalizeExternalImageUrl = (raw = "") => {
    let value = String(raw || "").trim().replace(/^['"]+|['"]+$/g, "");
    if (!value) return "";
    if (value.startsWith("//")) return `https:${value}`;
    return value;
};

const encodeImageUrlParam = (url = "") => (
    Buffer.from(String(url || ""), "utf8").toString("base64url")
);

const decodeImageUrlParam = (encoded = "") => {
    try {
        return Buffer.from(String(encoded || ""), "base64url").toString("utf8");
    } catch {
        return "";
    }
};

const isAllowedExternalImageUrl = (rawUrl = "") => {
    const value = normalizeExternalImageUrl(rawUrl);
    if (!value || /^data:|^blob:/i.test(value)) return false;

    try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) return false;
        return ALLOWED_HOST_RE.test(parsed.hostname);
    } catch {
        return false;
    }
};

const shouldProxyDescriptionImage = (rawUrl = "") => isAllowedExternalImageUrl(rawUrl);

const getApiPublicBase = (req = null) => {
    if (req) {
        const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.get("host");
        if (host) {
            return String(process.env.API_PUBLIC_URL || `${proto}://${host}`).replace(/\/+$/, "");
        }
    }

    const fromEnv = String(
        process.env.API_PUBLIC_URL
        || process.env.BASE_URL
        || global.env?.BASE_URL
        || global.env?.apiBaseUrl
        || ""
    ).trim();
    return fromEnv.replace(/\/+$/, "");
};

const buildDescriptionImageProxyUrl = (rawUrl = "", apiBase = "") => {
    const imageUrl = normalizeExternalImageUrl(rawUrl);
    if (!shouldProxyDescriptionImage(imageUrl)) return imageUrl;
    if (PROXIED_DESCRIPTION_IMAGE_RE.test(imageUrl)) return imageUrl;

    const base = String(apiBase || getApiPublicBase()).replace(/\/+$/, "");
    if (!base) return imageUrl;

    return `${base}/api/v1/products/description-image/${encodeImageUrlParam(imageUrl)}`;
};

const stripEmptyDescriptionTemplates = (html = "") => (
    String(html || "")
        .replace(/<div[^>]*id=["']offer-template-0["'][^>]*>\s*<\/div>/gi, "")
);

const rewriteDescriptionImageHtml = (html = "", apiBase = "") => {
    const source = stripEmptyDescriptionTemplates(html);
    if (!source) return source;

    return source.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
        const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const rawSrc = srcMatch ? (srcMatch[2] || srcMatch[3] || srcMatch[4] || "") : "";
        const proxied = buildDescriptionImageProxyUrl(rawSrc, apiBase);
        if (!proxied || proxied === normalizeExternalImageUrl(rawSrc)) {
            return match;
        }

        let nextAttrs = attrs.replace(
            /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i,
            `src="${proxied}"`
        );
        if (!/referrerpolicy\s*=/i.test(nextAttrs)) {
            nextAttrs += ' referrerpolicy="no-referrer"';
        }
        if (!/loading\s*=/i.test(nextAttrs)) {
            nextAttrs += ' loading="lazy"';
        }
        if (!/decoding\s*=/i.test(nextAttrs)) {
            nextAttrs += ' decoding="async"';
        }
        return `<img${nextAttrs}>`;
    });
};

const resolveProxyImageSource = (req = {}) => {
    const encoded = req.params?.encodedUrl;
    if (encoded) {
        return decodeImageUrlParam(encoded);
    }
    return req.query?.url;
};

const fetchExternalImageStream = async (rawUrl = "") => {
    const imageUrl = normalizeExternalImageUrl(rawUrl);
    if (!isAllowedExternalImageUrl(imageUrl)) {
        const error = new Error("INVALID_IMAGE_URL");
        error.code = "INVALID_IMAGE_URL";
        throw error;
    }

    const response = await axios.get(imageUrl, {
        responseType: "stream",
        timeout: 20000,
        maxRedirects: 4,
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; UzaBulk/1.0)",
            Referer: "https://detail.1688.com/",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = String(response.headers["content-type"] || "").split(";")[0].trim();
    if (!contentType || !/^image\//i.test(contentType)) {
        const error = new Error("UNSUPPORTED_IMAGE_TYPE");
        error.code = "UNSUPPORTED_IMAGE_TYPE";
        throw error;
    }

    return { stream: response.data, contentType };
};

module.exports = {
    normalizeExternalImageUrl,
    encodeImageUrlParam,
    decodeImageUrlParam,
    isAllowedExternalImageUrl,
    shouldProxyDescriptionImage,
    getApiPublicBase,
    buildDescriptionImageProxyUrl,
    stripEmptyDescriptionTemplates,
    rewriteDescriptionImageHtml,
    resolveProxyImageSource,
    fetchExternalImageStream,
};
