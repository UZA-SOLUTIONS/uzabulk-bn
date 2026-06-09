/* eslint-disable no-console */
require("../utils/globals");
require("../config/db");

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const ProductBehavior = require("../models/productBehaviorTable");

const OUTPUT_FILE = path.join(__dirname, "..", "tmp", "search-audit-queries.json");
const SAMPLE_LIMIT = 120;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDb = async (timeoutMs = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (mongoose.connection.readyState === 1) return;
        await delay(200);
    }
    throw new Error("Timed out waiting for MongoDB connection.");
};

const normalizeQuery = (value = "") =>
    String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const guessQueryType = (query) => {
    if (/^[a-f0-9]{24}$/i.test(query) || /^[a-z0-9_-]{6,}$/i.test(query) && /\d/.test(query)) return "sku_or_id";
    if (query.includes(" ")) return "long_tail";
    if (query.length <= 3) return "short";
    return "generic";
};

const run = async () => {
    await waitForDb();
    const rows = await ProductBehavior.aggregate([
        { $match: { eventType: "search", search: { $type: "string", $ne: "" } } },
        {
            $project: {
                q: {
                    $toLower: {
                        $trim: { input: "$search" },
                    },
                },
            },
        },
        { $match: { q: { $ne: "" } } },
        { $group: { _id: "$q", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: SAMPLE_LIMIT },
    ]);

    const frequent = rows.map((r) => ({
        query: normalizeQuery(r._id),
        count: r.count,
        type: guessQueryType(normalizeQuery(r._id)),
    }));

    const typoSamples = frequent
        .filter((item) => item.query.length >= 5)
        .slice(0, 20)
        .map((item) => ({ source: item.query, typo: `${item.query.slice(0, -1)}x` }));

    const payload = {
        generatedAt: new Date().toISOString(),
        totalQueries: frequent.length,
        buckets: {
            exact: frequent.slice(0, 40),
            longTail: frequent.filter((q) => q.type === "long_tail").slice(0, 40),
            skuOrId: frequent.filter((q) => q.type === "sku_or_id").slice(0, 20),
            typoCandidates: typoSamples,
        },
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote search audit set -> ${OUTPUT_FILE}`);
};

run()
    .catch((error) => {
        console.error("searchAuditQueries failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        setTimeout(() => process.exit(), 100);
    });
