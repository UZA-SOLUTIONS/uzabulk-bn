/* eslint-disable no-console */
require("../utils/globals");
require("../config/db");

const mongoose = require("mongoose");
const {
    searchProductsQuery,
    getProductDetail,
} = require("../modules/products/services/alibaba");
const { updateProductDetails } = require("../modules/products/helper/migration");

const DEFAULT_STORE_TYPE_ID = "660e3c271095513081ed2223";
const DEFAULT_VENDOR_ID = "6625f5426b433d206e538ec2";
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_KEYWORDS = ["women", "men", "shoes", "bags", "electronics"];

const parseIntegerArg = (flag, fallback) => {
    const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    if (!raw) return fallback;
    const value = Number(raw.split("=")[1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseKeywords = () => {
    const raw = process.argv.find((arg) => arg.startsWith("--keywords="));
    if (!raw) return DEFAULT_KEYWORDS;
    return raw
        .split("=")[1]
        .split(",")
        .map((value) => String(value || "").trim())
        .filter(Boolean);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDbAndModels = async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (mongoose.connection.readyState === 1 && global._model?.Product) return;
        await delay(250);
    }
    throw new Error("Timed out waiting for MongoDB/models initialization.");
};

const runWithConcurrency = async (items, worker, concurrency) => {
    let index = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (index < items.length) {
            const current = index;
            index += 1;
            await worker(items[current], current);
        }
    });
    await Promise.all(workers);
};

const discoverOfferIds = async ({ keywords, pages, pageSize, country }) => {
    const ids = new Set();
    for (const keyword of keywords) {
        for (let page = 1; page <= pages; page += 1) {
            const result = await searchProductsQuery({
                keyword,
                beginPage: page,
                pageSize,
                country,
            });
            const rows = Array.isArray(result?.data) ? result.data : [];
            rows.forEach((row) => {
                const offerId = String(row?.offerId || "").trim();
                if (/^\d+$/.test(offerId)) {
                    ids.add(offerId);
                }
            });
            if (!rows.length) {
                break;
            }
        }
    }
    return [...ids];
};

const importOffers = async (offerIds, concurrency) => {
    const stats = { success: 0, failed: 0 };

    await runWithConcurrency(
        offerIds,
        async (offerId, index) => {
            try {
                console.log(`[${index + 1}/${offerIds.length}] Importing offerId=${offerId}`);
                const details = await getProductDetail(offerId);
                if (!details) {
                    stats.failed += 1;
                    return;
                }

                let product = await _model.Product.findOne({ offerId })
                    .select("_id offerId vendor")
                    .lean();

                if (!product?._id) {
                    const created = await _model.Product.create({
                        storeType: DEFAULT_STORE_TYPE_ID,
                        vendor: DEFAULT_VENDOR_ID,
                        name: details.subjectTrans || `Imported ${offerId}`,
                        type: "simple",
                        status: "inactive",
                        offerId,
                        adminSold: true,
                        external: true,
                    });
                    product = { _id: created._id, offerId, vendor: created.vendor };
                }

                await updateProductDetails(product, details);
                stats.success += 1;
            } catch (error) {
                stats.failed += 1;
                console.error(`Import failed for offerId=${offerId}:`, error.message);
            }
        },
        concurrency
    );

    return stats;
};

const main = async () => {
    const keywords = parseKeywords();
    const pages = parseIntegerArg("--pages", 2);
    const pageSize = parseIntegerArg("--pageSize", 20);
    const concurrency = parseIntegerArg("--concurrency", DEFAULT_CONCURRENCY);
    const countryRaw = process.argv.find((arg) => arg.startsWith("--country="));
    const country = countryRaw ? String(countryRaw.split("=")[1] || "en").trim() : "en";

    await waitForDbAndModels();

    console.log("Discovering offer IDs from API...");
    const offerIds = await discoverOfferIds({ keywords, pages, pageSize, country });
    console.log(`Discovered ${offerIds.length} unique offer IDs.`);

    if (!offerIds.length) {
        console.log("No offer IDs discovered from API search.");
        return;
    }

    const stats = await importOffers(offerIds, concurrency);
    console.log("Bootstrap import complete.");
    console.log(`Success: ${stats.success}`);
    console.log(`Failed: ${stats.failed}`);
};

main()
    .then(async () => {
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error("Bootstrap failed:", error.message);
        try {
            await mongoose.connection.close();
        } catch (_error) {
            // noop
        }
        process.exit(1);
    });
