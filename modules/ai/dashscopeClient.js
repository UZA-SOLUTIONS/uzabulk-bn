const OpenAI = require("openai");
const { resolveBaseUrl } = require("./helpers/dashscopeConfig");

let client = null;

const getDashscopeClient = () => {
    const apiKey = env?.dashscope?.API_KEY;
    if (!apiKey) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    if (!client) {
        client = new OpenAI({
            apiKey,
            baseURL: resolveBaseUrl(),
            timeout: env.dashscope.TIMEOUT_MS || 60000,
        });
    }
    return client;
};

const isDashscopeConfigured = () => Boolean(env?.dashscope?.API_KEY);

module.exports = {
    getDashscopeClient,
    isDashscopeConfigured,
};
