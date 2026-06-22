const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { guessLocalImagePath } = require("../../ai/helpers/resolveVisionImageInput");

const LOCAL_IMAGE_SEARCH_ENABLED =
    Boolean(env?.localImageSearch?.ENABLED) ||
    String(process.env.LOCAL_IMAGE_SEARCH_ENABLED || "").toLowerCase() === "true";
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
const LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES =
    Number(process.env.LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES || 80);

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

const searchLocalImage = async ({ imageAddress, limit = 32 }) => {
    if (!LOCAL_IMAGE_SEARCH_ENABLED) return null;
    if (!imageAddress || typeof imageAddress !== "string") return null;

    const args = [
        LOCAL_IMAGE_SEARCH_SCRIPT,
        "search",
        ...buildQueryArgs(imageAddress),
        "--top-k",
        String(Math.max(1, Number(limit) || 32)),
        "--index-path",
        LOCAL_IMAGE_SEARCH_INDEX,
        "--meta-path",
        LOCAL_IMAGE_SEARCH_META,
    ];

    try {
        const { stdout } = await execFileAsync(LOCAL_IMAGE_SEARCH_PYTHON_BIN, args, {
            timeout: 180000,
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || "{}"));
        if (!Array.isArray(parsed?.results)) return null;

        const offerIds = parsed.results
            .map((entry) => String(entry?.offerId || "").trim())
            .filter(Boolean);

        return {
            provider: "local",
            offerIds,
            total: Number(parsed?.count || offerIds.length || 0),
        };
    } catch (error) {
        console.error("Local image search failed:", error?.stderr || error?.message || error);
        return null;
    }
};

const searchLocalImageLive = async ({ imageAddress, candidates = [], limit = 32 }) => {
    if (!LOCAL_IMAGE_SEARCH_ENABLED) return null;
    if (!imageAddress || typeof imageAddress !== "string") return null;

    const trimmedCandidates = (candidates || [])
        .slice(0, Number.isFinite(LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES) && LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES > 0
            ? LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES
            : 80)
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
            String(Math.max(1, Number(limit) || 32)),
            "--products-json",
            tempPath,
        ];
        const { stdout } = await execFileAsync(LOCAL_IMAGE_SEARCH_PYTHON_BIN, args, {
            timeout: 180000,
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024,
        });
        const parsed = JSON.parse(String(stdout || "{}"));
        if (!Array.isArray(parsed?.results)) return null;

        const offerIds = parsed.results
            .map((entry) => String(entry?.offerId || "").trim())
            .filter(Boolean);

        return {
            provider: "local-live",
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

module.exports = { searchLocalImage, searchLocalImageLive };
