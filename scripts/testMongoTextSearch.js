require("../utils/globals");
const { connectDatabase } = require("../config/db");
const Product = require("../models/productsTable");

const run = async () => {
    await connectDatabase();
    await new Promise((r) => setTimeout(r, 2000));

    for (const q of ["glasses", "eyeglasses", "packaging", "bottle", "glass", "water bottle", "plastic bottle", "drinking glass"]) {
        const started = Date.now();
        try {
            const items = await Product.find(
                { status: "active", $text: { $search: q } },
                { score: { $meta: "textScore" } }
            )
                .select("name")
                .sort({ score: { $meta: "textScore" } })
                .limit(5)
                .maxTimeMS(8000)
                .lean();
            console.log(q, "text", items.length, "ms", Date.now() - started, items[0]?.name?.slice(0, 60) || "");
        } catch (error) {
            console.log(q, "ERR", error.message);
        }
    }
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
