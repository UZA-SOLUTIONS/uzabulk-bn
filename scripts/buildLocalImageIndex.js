require("../utils/globals");
require("../config/db");

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PYTHON_BIN = process.env.LOCAL_IMAGE_SEARCH_PYTHON_BIN || "python";
const PYTHON_SCRIPT = process.env.LOCAL_IMAGE_SEARCH_SCRIPT || path.resolve(__dirname, "image_similarity_search.py");
const OUTPUT_DIR = process.env.LOCAL_IMAGE_SEARCH_OUTPUT_DIR || path.resolve(process.cwd(), "data", "image-search");
const PRODUCTS_JSON = path.join(OUTPUT_DIR, "products.json");
const INDEX_PATH = process.env.LOCAL_IMAGE_SEARCH_INDEX || path.join(OUTPUT_DIR, "products.index.faiss");
const META_PATH = process.env.LOCAL_IMAGE_SEARCH_META || path.join(OUTPUT_DIR, "products.meta.json");
const BUILD_LIMIT = Number(process.env.LOCAL_IMAGE_SEARCH_BUILD_LIMIT || 0);
const IMAGES_PER_PRODUCT = Math.min(
    Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_IMAGES_PER_PRODUCT || 4), 1),
    8
);

const waitForModelsReady = (timeoutMs = 60000) =>
    new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (global._model?.Product) {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - startedAt > timeoutMs) {
                clearInterval(timer);
                reject(new Error("Timed out waiting for models to initialize."));
            }
        }, 250);
    });

const resolveImageUrl = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object" && value.link) return String(value.link).trim();
    return "";
};

const collectProductImageUrls = (product, maxImages = IMAGES_PER_PRODUCT) => {
    const urls = [];
    const add = (value) => {
        const url = resolveImageUrl(value);
        if (url && !urls.includes(url)) urls.push(url);
    };
    add(product?.featured_image);
    (product?.images || []).forEach(add);
    return urls.slice(0, maxImages);
};

const run = async () => {
    try {
        await waitForModelsReady();

        let query = _model.Product.find({ status: "active" })
            .select("offerId name featured_image images")
            .sort({ sold_count: -1, date_created_utc: -1 });

        if (Number.isFinite(BUILD_LIMIT) && BUILD_LIMIT > 0) {
            query = query.limit(BUILD_LIMIT);
        }

        const products = await query.lean();

        const dataset = [];
        products.forEach((product) => {
            const offerId = String(product?.offerId || "").trim();
            if (!offerId) return;
            const imageUrls = collectProductImageUrls(product);
            imageUrls.forEach((imageUrl) => {
                dataset.push({
                    offerId,
                    name: product?.name || "",
                    imageUrl,
                });
            });
        });

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(dataset, null, 2), "utf-8");
        console.log(`Prepared ${dataset.length} image rows from ${products.length} products.`);

        const args = [
            PYTHON_SCRIPT,
            "build",
            "--products-json",
            PRODUCTS_JSON,
            "--index-path",
            INDEX_PATH,
            "--meta-path",
            META_PATH,
        ];

        execFile(PYTHON_BIN, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Failed to build local image index:", stderr || error.message);
                process.exit(1);
            }
            console.log(stdout || "Local image index built.");
            process.exit(0);
        });
    } catch (error) {
        console.error("Failed to prepare local image index dataset:", error?.message || error);
        process.exit(1);
    }
};

run();
