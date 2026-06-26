#!/usr/bin/env node
/**
 * Batch-translate API locale keys to French using DashScope (qwen-turbo).
 * Usage: node scripts/translateApiLocales.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { translateEntriesToFrench } = require("../modules/i18n/translationService");

const LOCALES_DIR = path.join(__dirname, "..", "locales");
const EN_PATH = path.join(LOCALES_DIR, "en.json");
const FR_PATH = path.join(LOCALES_DIR, "fr.json");

const USER_FACING_KEY_PATTERN = /^[A-Z0-9_]+$|required|not allowed|maximum quantity|items\(s\)|Search failed/;

async function main() {
    const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
    const existingFr = fs.existsSync(FR_PATH)
        ? JSON.parse(fs.readFileSync(FR_PATH, "utf8"))
        : {};

    const toTranslate = {};
    for (const [key, value] of Object.entries(en)) {
        if (existingFr[key]) continue;
        if (!value || typeof value !== "string") continue;
        if (!USER_FACING_KEY_PATTERN.test(key) && value.length > 120) continue;
        toTranslate[key] = value;
    }

    const keys = Object.keys(toTranslate);
    if (!keys.length) {
        console.log("fr.json is already up to date.");
        return;
    }

    console.log(`Translating ${keys.length} keys via DashScope…`);
    const batchSize = 25;
    const merged = { ...existingFr };

    for (let i = 0; i < keys.length; i += batchSize) {
        const slice = keys.slice(i, i + batchSize);
        const batch = Object.fromEntries(slice.map((k) => [k, toTranslate[k]]));
        const translated = await translateEntriesToFrench(batch);
        Object.assign(merged, translated);
        console.log(`  ${Math.min(i + batchSize, keys.length)} / ${keys.length}`);
    }

    fs.writeFileSync(FR_PATH, `${JSON.stringify(merged, null, "\t")}\n`, "utf8");
    console.log(`Wrote ${FR_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
