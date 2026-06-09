const { getDashscopeClient } = require("../dashscopeClient");
const {
    getChatModelFallbacks,
    isAccessDeniedError,
} = require("../helpers/resolveChatModel");

/**
 * Chat completion trying configured model(s); falls back to qwen-vl-plus when plus/turbo denied.
 */
const chatCompletionWithFallback = async (options = {}) => {
    const client = getDashscopeClient();
    const models = options.model
        ? [options.model]
        : getChatModelFallbacks();

    let lastError = null;
    for (const model of models) {
        try {
            const response = await client.chat.completions.create({
                ...options,
                model,
            });
            return {
                response,
                model,
                content: response.choices?.[0]?.message?.content ?? "",
            };
        } catch (error) {
            lastError = error;
            if (!isAccessDeniedError(error)) {
                throw error;
            }
        }
    }

    const hint =
        "Enable qwen-plus (or qwen-flash) in Model Studio → Authorization, "
        + "or set DASHSCOPE_MODEL=qwen-vl-plus in .env (works with vision-only access).";
    const err = new Error(
        `All chat models denied (${models.join(", ")}). ${hint}`
    );
    err.cause = lastError;
    throw err;
};

module.exports = { chatCompletionWithFallback };
