const axios = require("axios");
const { resolveBaseUrl } = require("../helpers/dashscopeConfig");
const { chatCompletionWithFallback } = require("./chatWithFallback");

const isConfigured = () => Boolean(env?.dashscope?.API_KEY);

/**
 * OpenAI-compatible chat completion (Alibaba Model Studio / DashScope).
 * @param {{ messages: Array<{role: string, content: string}>, model?: string, temperature?: number, max_tokens?: number }}
 */
const chatCompletion = async ({
    messages,
    model,
    temperature = 0.7,
    max_tokens,
} = {}) => {
    const apiKey = env?.dashscope?.API_KEY;
    if (!apiKey) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    if (!Array.isArray(messages) || !messages.length) {
        throw new Error("messages array is required");
    }

    const baseURL = resolveBaseUrl();
    const url = `${baseURL}/chat/completions`;
    const payload = {
        model: model || env.dashscope.MODEL || "qwen-vl-plus",
        messages,
        temperature,
    };
    if (max_tokens != null) payload.max_tokens = max_tokens;

    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        timeout: env.dashscope.TIMEOUT_MS || 60000,
    });

    const choice = response?.data?.choices?.[0];
    const content = choice?.message?.content ?? "";
    return {
        content,
        model: response?.data?.model || payload.model,
        usage: response?.data?.usage || null,
        raw: response?.data,
    };
};

/** One-shot user prompt with model fallback (qwen-vl-plus when plus/turbo denied). */
const completePrompt = async (prompt, options = {}) => {
    const { content } = await chatCompletionWithFallback({
        messages: [{ role: "user", content: String(prompt) }],
        ...options,
    });
    return content;
};

module.exports = {
    isConfigured,
    resolveBaseUrl,
    chatCompletion,
    completePrompt,
};
