const fs = require("fs");
const path = require("path");
const axios = require("axios");

const LOCAL_IMAGES_DIR = path.resolve(__dirname, "../../../public/images");
/** Skip embedding huge phone photos as base64 — DashScope can fetch a public URL instead. */
const MAX_INLINE_BYTES = Math.max(
    Number(process.env.VISION_INLINE_MAX_BYTES || 900 * 1024),
    200 * 1024
);

const guessLocalImagePath = (imageUrl = "") => {
    const raw = String(imageUrl || "").trim();
    if (!raw) return null;

    let pathname = raw;
    try {
        pathname = new URL(raw).pathname || raw;
    } catch (_) {
        pathname = raw;
    }

    const marker = "/images/";
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;

    const filename = path.basename(pathname.split("?")[0]);
    if (!filename || filename.includes("..")) return null;

    const localPath = path.join(LOCAL_IMAGES_DIR, filename);
    return fs.existsSync(localPath) ? localPath : null;
};

const toDataUrl = (localPath) => {
    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mime = ext === ".png"
        ? "image/png"
        : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
                ? "image/gif"
                : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
};

const buildPublicImageUrl = (localPath, originalUrl = "") => {
    const filename = path.basename(localPath);
    const base = String(env?.BASE_URL || process.env.BASE_URL || "").replace(/\/+$/, "");
    if (base) return `${base}/images/${filename}`;

    const raw = String(originalUrl || "").trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    return "";
};

const isUrlReachable = async (url, timeoutMs = 4000) => {
    try {
        const head = await axios.head(url, {
            timeout: timeoutMs,
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        if (head?.status) return true;
    } catch (_) {
        // Some CDNs reject HEAD — fall through to a tiny ranged GET.
    }

    try {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: timeoutMs,
            maxRedirects: 3,
            headers: { Range: "bytes=0-1023" },
            validateStatus: (status) => status >= 200 && status < 400,
        });
        return (res?.data?.byteLength || 0) > 0;
    } catch (_) {
        return false;
    }
};

/**
 * Resolve image for DashScope VL: prefer compact local base64, else public HTTPS URL.
 * Large local uploads use the public /images URL instead of multi‑MB data URLs.
 */
const resolveVisionImageInput = async (imageAddress) => {
    const url = String(imageAddress || "").trim();
    if (!url) throw new Error("imageAddress is required");

    const localPath = guessLocalImagePath(url);
    if (localPath) {
        const size = fs.statSync(localPath).size;
        if (size <= MAX_INLINE_BYTES) {
            return {
                type: "image_url",
                image_url: { url: toDataUrl(localPath) },
                source: "local_file",
            };
        }

        const publicUrl = buildPublicImageUrl(localPath, url);
        if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
            return {
                type: "image_url",
                image_url: { url: publicUrl },
                source: "local_public_url",
            };
        }

        // Last resort: still inline (may be slow) so search does not fail.
        return {
            type: "image_url",
            image_url: { url: toDataUrl(localPath) },
            source: "local_file_large",
        };
    }

    if (/^data:image\//i.test(url)) {
        return {
            type: "image_url",
            image_url: { url },
            source: "data_url",
        };
    }

    const reachable = await isUrlReachable(url);
    if (reachable) {
        return {
            type: "image_url",
            image_url: { url },
            source: "remote_url",
        };
    }

    throw new Error(
        "Image is not reachable for AI vision analysis. Re-upload the photo or use a public HTTPS image URL."
    );
};

module.exports = {
    resolveVisionImageInput,
    guessLocalImagePath,
    LOCAL_IMAGES_DIR,
};
