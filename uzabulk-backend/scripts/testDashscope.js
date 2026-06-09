/* eslint-disable no-console */
/**
 * Smoke test: Alibaba Model Studio (DashScope) OpenAI-compatible API.
 *   node scripts/testDashscope.js
 *   node scripts/testDashscope.js "Translate to English: 优质供应商"
 */
require("../utils/globals");
const { isDashscopeConfigured } = require("../modules/ai/dashscopeClient");
const { resolveBaseUrl } = require("../modules/ai/services/dashscopeService");
const { chatCompletionWithFallback } = require("../modules/ai/services/chatWithFallback");
const { getConfiguredChatModel } = require("../modules/ai/helpers/resolveChatModel");

const run = async () => {
    if (!isDashscopeConfigured()) {
        console.error("Set DASHSCOPE_API_KEY in .env first.");
        process.exit(1);
    }

    console.log("Base URL:", resolveBaseUrl());
    console.log("Configured model:", getConfiguredChatModel());
    console.log("Embedding model:", env.dashscope.EMBEDDING_MODEL);

    const prompt = process.argv.slice(2).join(" ").trim()
        || "Reply in one short sentence: who are you?";

    const { content, model } = await chatCompletionWithFallback({
        messages: [{ role: "user", content: prompt }],
    });
    console.log("Model used:", model);
    console.log("\nResponse:\n", content);
};

run().catch((error) => {
    console.error("DashScope test failed:", error?.response?.data || error.message);
    process.exit(1);
});
