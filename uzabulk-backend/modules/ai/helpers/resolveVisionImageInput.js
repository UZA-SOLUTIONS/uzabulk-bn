const fs = require("fs");
const path = require("path");
const axios = require("axios");

const LOCAL_IMAGES_DIR = path.resolve(__dirname, "../../../public/images");

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

const isUrlReachable = async (url, timeoutMs = 8000) => {
    try {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: timeoutMs,
            maxRedirects: 3,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        return res?.data?.byteLength > 0;
    } catch (_) {
        return false;
    }
};

/**
 * Resolve image for DashScope VL: prefer local upload file (base64), else public HTTPS URL.
 */
const resolveVisionImageInput = async (imageAddress) => {
    const url = String(imageAddress || "").trim();
    if (!url) throw new Error("imageAddress is required");

    const localPath = guessLocalImagePath(url);
    if (localPath) {
        return {
            type: "image_url",
            image_url: { url: toDataUrl(localPath) },
            source: "local_file",
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
