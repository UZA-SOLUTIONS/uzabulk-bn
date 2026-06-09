/* eslint-disable no-console */
require("../utils/globals");
require("../config/db");

const mongoose = require("mongoose");

const DEFAULT_STORE_TYPE_ID = "660e3c271095513081ed2223";
const DEFAULT_VENDOR_ID = "6625f5426b433d206e538ec2";
const DEFAULT_TIMEOUT_MS = 45000;

const parseIntegerArg = (flag, fallback) => {
    const raw = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    if (!raw) return fallback;
    const value = Number(raw.split("=")[1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
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

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const slugify = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

const buildSeedProduct = (index) => {
    const titles = [
        "Women's Casual Sneakers",
        "Men's Running Shoes",
        "Travel Backpack 30L",
        "Bluetooth Earbuds Pro",
        "Stainless Water Bottle",
        "Cotton T-Shirt Premium",
        "Portable Phone Holder",
        "LED Desk Lamp",
        "Smart Fitness Band",
        "Non-Slip Yoga Mat",
    ];
    const pricingType = ["unit", "piece", "set"];
    const stock = Math.floor(Math.random() * 150) + 20;
    const price = Number((Math.random() * 90 + 10).toFixed(2));
    const compare = Number((price + Math.random() * 20 + 5).toFixed(2));
    const name = `${randomFrom(titles)} ${index + 1}`;
    const now = new Date();
    const offerId = `LOCAL-${Date.now()}-${index + 1}`;
    const slug = `${slugify(name)}-${Date.now()}-${index + 1}`;

    return {
        storeType: DEFAULT_STORE_TYPE_ID,
        vendor: DEFAULT_VENDOR_ID,
        name,
        slug,
        type: "simple",
        status: "active",
        isFeatured: index % 3 === 0,
        short_description: "Seeded product for initial catalog bootstrap.",
        description: `${name} imported from local seed to start catalog usage.`,
        price,
        compare_price: compare,
        manage_stock: true,
        bestSeller: index % 4 === 0,
        stock_quantity: stock,
        pricingType: randomFrom(pricingType),
        stock_status: stock > 0 ? "instock" : "outofstock",
        featured_image: `https://picsum.photos/seed/uzabulk-${index + 1}/640/640`,
        images: [
            `https://picsum.photos/seed/uzabulk-${index + 1}-a/640/640`,
            `https://picsum.photos/seed/uzabulk-${index + 1}-b/640/640`,
        ],
        average_rating: Number((Math.random() * 2 + 3).toFixed(1)),
        rating_count: Math.floor(Math.random() * 300),
        sold_count: Math.floor(Math.random() * 800),
        shippingCharge: 0,
        adminSold: true,
        offerId,
        external: false,
        date_created_utc: now,
        date_modified_utc: now,
        last_updated: now,
    };
};

const main = async () => {
    const count = parseIntegerArg("--count", 24);
    await waitForDbAndModels();

    const docs = Array.from({ length: count }, (_, i) => buildSeedProduct(i));
    const created = await _model.Product.insertMany(docs, { ordered: false });
    console.log(`Seeded ${created.length} products successfully.`);
};

main()
    .then(async () => {
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error("Seed failed:", error.message);
        try {
            await mongoose.connection.close();
        } catch (_error) {
            // noop
        }
        process.exit(1);
    });
