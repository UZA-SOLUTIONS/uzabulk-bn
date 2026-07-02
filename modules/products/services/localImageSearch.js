const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { guessLocalImagePath } = require("../../ai/helpers/resolveVisionImageInput");

const LOCAL_IMAGE_SEARCH_ENABLED_DEFAULT =
    String(process.env.LOCAL_IMAGE_SEARCH_ENABLED ?? "true").toLowerCase() !== "false"
    && String(process.env.LOCAL_IMAGE_SEARCH_ENABLED ?? "true").toLowerCase() !== "0";

const LOCAL_IMAGE_SEARCH_PYTHON_BIN =
    env?.localImageSearch?.PYTHON_BIN ||
    process.env.LOCAL_IMAGE_SEARCH_PYTHON_BIN ||
    "python";
const LOCAL_IMAGE_SEARCH_SCRIPT =
    env?.localImageSearch?.SCRIPT ||
    process.env.LOCAL_IMAGE_SEARCH_SCRIPT ||
    path.resolve(process.cwd(), "scripts", "image_similarity_search.py");
const LOCAL_IMAGE_SEARCH_INDEX =
    env?.localImageSearch?.INDEX_PATH ||
    process.env.LOCAL_IMAGE_SEARCH_INDEX ||
    path.resolve(process.cwd(), "data", "image-search", "products.index.faiss");
const LOCAL_IMAGE_SEARCH_META =
    env?.localImageSearch?.META_PATH ||
    process.env.LOCAL_IMAGE_SEARCH_META ||
    path.resolve(process.cwd(), "data", "image-search", "products.meta.json");
const LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES = Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES || 120), 20),
    300
);
const LOCAL_IMAGE_SEARCH_MIN_SIMILARITY = Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_MIN_SIMILARITY || 0.38), 0),
    1
);

const isLocalImageSearchEnabled = () => {
    const flag = String(process.env.LOCAL_IMAGE_SEARCH_ENABLED ?? "true").toLowerCase();
    if (flag === "0" || flag === "false") return false;
    return LOCAL_IMAGE_SEARCH_ENABLED_DEFAULT;
};

const hasLocalImageIndex = () => {
    try {
        return fs.existsSync(LOCAL_IMAGE_SEARCH_INDEX);
    } catch (_) {
        return false;
    }
};

const execFileAsync = (bin, args, options = {}) =>
    new Promise((resolve, reject) => {
        execFile(bin, args, options, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });

const buildQueryArgs = (imageAddress = "") => {
    const localPath = guessLocalImagePath(imageAddress);
    if (localPath) {
        return ["--query-file", localPath];
    }
    return ["--query-url", String(imageAddress || "").trim()];
};

const dedupeByOfferMaxSimilarity = (results = []) => {
    const best = new Map();
    (results || []).forEach((entry) => {
        const offerId = String(entry?.offerId || "").trim();
        const similarity = Number(entry?.similarity || 0);
        if (!offerId) return;
        const prev = best.get(offerId);
        if (!prev || similarity > prev.similarity) {
            best.set(offerId, { offerId, similarity });
        }
    });
    return [...best.values()].sort((a, b) => b.similarity - a.similarity);
};

const filterByMinSimilarity = (results = []) => {
    const min = LOCAL_IMAGE_SEARCH_MIN_SIMILARITY;
    const filtered = (results || []).filter((row) => Number(row?.similarity || 0) >= min);
    return filtered.length ? filtered : (results || []).slice(0, 3);
};

const searchLocalImage = async ({ imageAddress, limit = 32 }) => {
    if (!isLocalImageSearchEnabled() || !hasLocalImageIndex()) return null;
    if (!imageAddress || typeof imageAddress !== "string") return null;

    const args = [
        LOCAL_IMAGE_SEARCH_SCRIPT,
        "search",
        ...buildQueryArgs(imageAddress),
        "--top-k",
        String(Math.max(1, Number(limit) || 32) * 3),
        "--index-path",
        LOCAL_IMAGE_SEARCH_INDEX,
        "--meta-path",
        LOCAL_IMAGE_SEARCH_META,
    ];

    try {
        const { stdout } = await execFileAsync(LOCAL_IMAGE_SEARCH_PYTHON_BIN, args, {
            timeout: 25_000,
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || "{}"));
        if (!Array.isArray(parsed?.results)) return null;

        const results = filterByMinSimilarity(
            dedupeByOfferMaxSimilarity(parsed.results)
        ).slice(0, Math.max(1, Number(limit) || 32));

        const offerIds = results.map((entry) => entry.offerId).filter(Boolean);

        return {
            provider: "local",
            results,
            offerIds,
            total: Number(parsed?.count || offerIds.length || 0),
        };
    } catch (error) {
        console.error("Local image search failed:", error?.stderr || error?.message || error);
        return null;
    }
};

const searchLocalImageLive = async ({ imageAddress, candidates = [], limit = 32 }) => {
    if (!isLocalImageSearchEnabled()) return null;
    if (!imageAddress || typeof imageAddress !== "string") return null;

    const trimmedCandidates = (candidates || [])
        .slice(0, LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES)
        .map((c) => ({
            offerId: String(c?.offerId || "").trim(),
            imageUrl: String(c?.imageUrl || "").trim(),
            name: c?.name || "",
        }))
        .filter((c) => c.offerId && c.imageUrl);

    if (!trimmedCandidates.length) return null;

    const tempPath = path.join(os.tmpdir(), `image-search-live-${Date.now()}.json`);
    fs.writeFileSync(tempPath, JSON.stringify(trimmedCandidates), "utf-8");

    try {
        const args = [
            LOCAL_IMAGE_SEARCH_SCRIPT,
            "search-live",
            ...buildQueryArgs(imageAddress),
            "--top-k",
            String(Math.max(1, Number(limit) || 32) * 2),
            "--products-json",
            tempPath,
        ];
        const { stdout } = await execFileAsync(LOCAL_IMAGE_SEARCH_PYTHON_BIN, args, {
            timeout: 25_000,
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || "{}"));
        if (!Array.isArray(parsed?.results)) return null;

        const results = filterByMinSimilarity(
            dedupeByOfferMaxSimilarity(parsed.results)
        ).slice(0, Math.max(1, Number(limit) || 32));

        const offerIds = results.map((entry) => entry.offerId).filter(Boolean);

        return {
            provider: "local-live",
            results,
            offerIds,
            total: Number(parsed?.count || offerIds.length || 0),
        };
    } catch (error) {
        console.error("Local live image search failed:", error?.stderr || error?.message || error);
        return null;
    } finally {
        try { fs.unlinkSync(tempPath); } catch (_) { }
    }
};

module.exports = {
    isLocalImageSearchEnabled,
    hasLocalImageIndex,
    searchLocalImage,
    searchLocalImageLive,
    LOCAL_IMAGE_SEARCH_MIN_SIMILARITY,
};
