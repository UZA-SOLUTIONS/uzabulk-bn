require("../utils/globals");
const { connectDatabase } = require("../config/db");
const { searchCatalogByText } = require("../modules/products/services/catalogSearchService");
const Product = require("../models/productsTable");

const runQuery = async (q) => {
    const t = Date.now();
    try {
        const result = await searchCatalogByText({ search: q, limit: 32, skip: 1 });
        console.log(
            q,
            "ms=",
            Date.now() - t,
            "hits=",
            result.items.length,
            "engine=",
            result.searchMeta.engine,
            "primary=",
            result.searchMeta.primary
        );
        if (result.items[0]) {
            console.log("  top:", String(result.items[0].name).slice(0, 80));
        }
    } catch (error) {
        console.error(q, "FAILED", error?.message || error);
    }
};

const run = async () => {
    await connectDatabase();
    await new Promise((r) => setTimeout(r, 2000));

    for (const q of ["glass", "glasses", "packaging", "bottles", "water bottle"]) {
        await runQuery(q);
    }
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
