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
const BUILD_LIMIT = Number(process.env.LOCAL_IMAGE_SEARCH_BUILD_LIMIT || 1500);

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

const run = async () => {
    try {
        await waitForModelsReady();
        const products = await _model.Product.find({ status: "active" })
            .select("offerId name featured_image")
            .populate({ path: "featured_image", select: "link -_id" })
            .limit(Number.isFinite(BUILD_LIMIT) && BUILD_LIMIT > 0 ? BUILD_LIMIT : 1500)
            .lean();

        const dataset = products
            .map((p) => ({
                offerId: String(p?.offerId || "").trim(),
                name: p?.name || "",
                imageUrl:
                    typeof p?.featured_image === "string"
                        ? p.featured_image
                        : (p?.featured_image?.link || ""),
            }))
            .filter((p) => p.offerId && p.imageUrl);

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(dataset, null, 2), "utf-8");

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
