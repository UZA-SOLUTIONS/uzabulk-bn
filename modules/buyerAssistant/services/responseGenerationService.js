const { chatCompletionWithFallback } = require("../../ai/services/chatWithFallback");
const { languageLabel } = require("./languageDetectionService");

const ASSISTANT_MODEL = () =>
    process.env.DASHSCOPE_ASSISTANT_MODEL
    || process.env.DASHSCOPE_FAST_MODEL
    || process.env.DASHSCOPE_RANKING_MODEL
    || "qwen-turbo";

const CONTEXT_CHAR_LIMIT = () =>
    Math.min(Math.max(Number(process.env.BUYER_ASSISTANT_CONTEXT_CHARS || 420), 200), 900);

const buildSystemPrompt = (language) => {
    const langName = languageLabel(language);
    return `You are UZA Bulk AI Buyer Assistant — a helpful wholesale sourcing assistant for buyers only.

Rules:
- Answer ONLY using the provided context chunks. If context is insufficient, say you need the order ID or more details and set status mentally as EXCEPTION.
- Respond in ${langName} (${language}), matching the user's language even when context is in English.
- Be concise, professional, and friendly (2–5 short paragraphs max).
- When customer_profile, order_history, customer_cart, or customer_addresses chunks are present, you may answer about the signed-in buyer's name, contact info, recent orders, cart items, and saved addresses — never reveal data not in those chunks.
- For order status: cite order ID, status, carrier, waybill, and last tracking event when present.
- For products: cite name, price, MOQ, wholesale tiers, description, ratings, and availability from product_docs chunks. The buyer may ask by product name without an ID.
- Never invent tracking numbers, prices, or delivery dates not in context.
- Do not discuss seller-side operations or vendor dashboards.
- If the buyer expresses anger, fraud, or a dispute, acknowledge empathetically and mention a human agent will follow up.

End your reply with a line: SOURCES: comma-separated chunk titles used.`;
};

const formatContextBlock = (chunks = []) => {
    if (!chunks.length) return "No context retrieved.";
    const cap = CONTEXT_CHAR_LIMIT();
    return chunks
        .map((c, i) => `[${i + 1}] (${c.source}) ${c.title}\n${String(c.text || "").slice(0, cap)}`)
        .join("\n\n");
};

const parseAssistantOutput = (content = "") => {
    const text = String(content || "").trim();
    const sourcesMatch = text.match(/\nSOURCES:\s*(.+)$/i);
    const answer = sourcesMatch
        ? text.replace(/\nSOURCES:\s*.+$/i, "").trim()
        : text;

    const status = /(?:don't know|do not know|cannot find|insufficient|not in context|need your order)/i.test(answer)
        ? "EXCEPTION"
        : "ok";

    const sources = sourcesMatch
        ? sourcesMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    return { answer, status, sources };
};

const generateBuyerResponse = async ({
    userMessage,
    language = "en",
    chunks = [],
    conversationHistory = [],
} = {}) => {
    const contextBlock = formatContextBlock(chunks);
    const historyMessages = (conversationHistory || [])
        .slice(-4)
        .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
        }));

    const messages = [
        { role: "system", content: buildSystemPrompt(language) },
        ...historyMessages,
        {
            role: "user",
            content: `Context:\n${contextBlock}\n\nBuyer question:\n${userMessage}`,
        },
    ];

    const { content, model } = await chatCompletionWithFallback({
        model: ASSISTANT_MODEL(),
        messages,
        temperature: 0.3,
        max_tokens: Math.min(Number(process.env.BUYER_ASSISTANT_MAX_TOKENS || 500), 900),
    });

    const parsed = parseAssistantOutput(content);

    return {
        ...parsed,
        model,
        contextCount: chunks.length,
    };
};

module.exports = {
    generateBuyerResponse,
    buildSystemPrompt,
    ASSISTANT_MODEL,
};
