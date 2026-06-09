/* eslint-disable no-console */
/**
 * Probe which DashScope models work with your API key + base URL.
 *   node scripts/probeDashscopeModels.js
 */
require("../utils/globals");
const OpenAI = require("openai");
const { resolveBaseUrl } = require("../modules/ai/services/dashscopeService");

const CHAT_CANDIDATES = [
    "qwen-plus",
    "qwen-plus-latest",
    "qwen-turbo",
    "qwen-turbo-latest",
    "qwen-flash",
    "qwen-max",
    "qwen-max-latest",
    "qwen2.5-72b-instruct",
    "qwen2.5-32b-instruct",
    "qwen2.5-7b-instruct",
    "qwen3-32b",
    "qwen3-14b",
    "qwen3-8b",
    "qwen3-4b",
    "qwen3-1.7b",
    "qwen3-0.6b",
    "qwen-vl-plus",
    "qwen-vl-max",
    "qwen2.5-vl-72b-instruct",
    "qwen2.5-vl-32b-instruct",
];

const EMBEDDING_CANDIDATES = [
    "text-embedding-v3",
    "text-embedding-v2",
    "text-embedding-v1",
];

const client = new OpenAI({
    apiKey: env.dashscope.API_KEY,
    baseURL: resolveBaseUrl(),
    timeout: 45000,
});

const tryChat = async (model) => {
    try {
        const res = await client.chat.completions.create({
            model,
            messages: [{ role: "user", content: "Say OK" }],
            max_tokens: 5,
        });
        const text = res.choices?.[0]?.message?.content || "";
        return { ok: true, preview: String(text).slice(0, 40) };
    } catch (error) {
        const code = error?.error?.code || error?.code || error?.status;
        const msg = error?.error?.message || error?.message || "unknown";
        return { ok: false, code, msg: String(msg).slice(0, 80) };
    }
};

const tryEmbedding = async (model) => {
    try {
        const res = await client.embeddings.create({
            model,
            input: "test product listing",
            dimensions: 1024,
        });
        const len = res?.data?.[0]?.embedding?.length || 0;
        return { ok: true, dimensions: len };
    } catch (error) {
        const code = error?.error?.code || error?.code || error?.status;
        const msg = error?.error?.message || error?.message || "unknown";
        return { ok: false, code, msg: String(msg).slice(0, 80) };
    }
};

const run = async () => {
    console.log("Base URL:", resolveBaseUrl());
    console.log("API key:", env.dashscope.API_KEY ? `***${String(env.dashscope.API_KEY).slice(-6)}` : "(missing)");
    console.log("\n--- Chat models ---");
    for (const model of CHAT_CANDIDATES) {
        const r = await tryChat(model);
        console.log(r.ok ? `OK   ${model} → ${r.preview}` : `FAIL ${model} → ${r.code || ""} ${r.msg}`);
    }
    console.log("\n--- Embedding models ---");
    for (const model of EMBEDDING_CANDIDATES) {
        const r = await tryEmbedding(model);
        console.log(r.ok ? `OK   ${model} → dim ${r.dimensions}` : `FAIL ${model} → ${r.code || ""} ${r.msg}`);
    }
};

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
