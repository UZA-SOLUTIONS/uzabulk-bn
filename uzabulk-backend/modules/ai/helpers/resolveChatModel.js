/**
 * Resolve chat model for DashScope OpenAI-compatible API.
 * Many accounts only authorize qwen-vl-plus + embeddings until qwen-plus is enabled in console.
 */
const getConfiguredChatModel = () =>
    env?.dashscope?.MODEL || "qwen-vl-plus";

const getVisionModel = () =>
    env?.dashscope?.VL_MODEL || "qwen-vl-plus";

const getChatModelFallbacks = () => {
    const primary = getConfiguredChatModel();
    const vl = getVisionModel();
    return [...new Set([primary, vl, "qwen-vl-plus"].filter(Boolean))];
};

const isAccessDeniedError = (error) => {
    const code = error?.error?.code || error?.code || "";
    const msg = String(error?.error?.message || error?.message || "");
    return code === "Model.AccessDenied" || /model access denied/i.test(msg);
};

module.exports = {
    getConfiguredChatModel,
    getVisionModel,
    getChatModelFallbacks,
    isAccessDeniedError,
};
