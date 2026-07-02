const { chatCompletionWithFallback } = require("../../ai/services/chatWithFallback");
const { languageLabel } = require("./languageDetectionService");

const ASSISTANT_MODEL = () =>
    process.env.DASHSCOPE_ASSISTANT_MODEL
    || process.env.DASHSCOPE_FAST_MODEL
    || process.env.DASHSCOPE_RANKING_MODEL
    || "qwen-turbo";

const CONTEXT_CHAR_LIMIT = () =>
    Math.min(Math.max(Number(process.env.BUYER_ASSISTANT_CONTEXT_CHARS || 420), 200), 900);

const buildSystemPrompt = (language, { hasProducts = false, isLoggedIn = false, isProductFinding = false } = {}) => {
    const langName = languageLabel(language);
    const sourcingRules = isProductFinding
        ? `
Sourcing / product search (this message):
- The buyer wants to FIND or SOURCE a product from the wholesale catalog — treat "I need…", "I want…", "do you have…", or similar as a product search.
- Lead with matching products from product_docs (name, price, MOQ). Product cards appear below your reply.
- Do NOT say the item is missing from their cart, orders, or profile unless they explicitly asked about cart/orders.
- Do NOT ask for fabric, style, size, or MOQ details before showing catalog matches — show matches first, then one short optional follow-up to narrow down.
- If product_docs has matches, recommend the best 1–2 options confidently.
- If no product_docs matches, say you searched the catalog and suggest they tap Search or try a simpler keyword — do not interrogate them with a long spec checklist.
- NEVER invent product names, prices, MOQ, materials, sizes, or warehouse locations. Only state facts from product_docs or ALLOWED_CATALOG_PRODUCTS.`
        : "";

    return `You are UZA Bulk AI Buyer Assistant — an agentic wholesale sourcing assistant for buyers.

Personality & task style:
- Act like a capable agent: understand the buyer's goal, answer with what you found, then suggest a clear next step they can take.
- When logged in${isLoggedIn ? " (this buyer is signed in)" : ""}, use profile, orders, cart, and addresses only when the buyer asks about account, cart, checkout, or order tracking — not when they are searching for new products to buy.
- When products are in context${hasProducts ? " (product cards will show in chat)" : ""}, summarize the best match first, then mention alternatives if several appear.
- Be concise (2–4 short paragraphs). Use bullet lines for order status or product specs when helpful.
${sourcingRules}

Formatting (critical):
- Highlight prices, MOQ, order IDs, statuses, dates, and product names with HTML <strong> tags only.
- Never use markdown asterisks (** or ***) or underscores for bold.
- Example: "The <strong>MOQ is 50 units</strong> at <strong>$12.50</strong> each."
- Do not output raw HTML except <strong> and <br/> inside paragraphs.

Rules:
- Answer ONLY using the provided context chunks. If context is insufficient, say what you need (order ID, product name, sign-in) and set status mentally as EXCEPTION.
- Respond in ${langName} (${language}), matching the user's language even when context is in English.
- For orders: cite order ID, status, carrier, waybill, last tracking event, and list ordered products with quantities and unit prices when order_products context is available.
- For products: cite name, price, MOQ, tiers, and availability from product_docs or order_products chunks only.
- NEVER invent product names, prices, MOQ, fabrics, sizes, or shipping origins. Product cards below the reply are the only products you may describe.
- Never invent tracking numbers, prices, or delivery dates not in context.
- Do not use markdown horizontal rules or dash separators (---, --, ___).
- Never use em-dash style separators like "text --- text"; use commas or short sentences instead.
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

const stripDashSeparators = (text = "") => {
    let out = String(text || "");
    out = out.replace(/^\s*[-–—_]{2,}\s*$/gm, "");
    out = out.replace(/\s+[-–—]{2,}\s+/g, ", ");
    out = out.replace(/\n{3,}/g, "\n\n");
    return out.trim();
};

const normalizeBoldMarkup = (text = "") => {
    let out = stripDashSeparators(text);
    out = out.replace(/\*{3}([^*]+)\*{3}/g, "<strong>$1</strong>");
    out = out.replace(/\*{2}([^*]+)\*{2}/g, "<strong>$1</strong>");
    out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    out = out.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "<strong>$1</strong>");
    return out;
};

const parseAssistantOutput = (content = "") => {
    const text = String(content || "").trim();
    const sourcesMatch = text.match(/\nSOURCES:\s*(.+)$/i);
    let answer = sourcesMatch
        ? text.replace(/\nSOURCES:\s*.+$/i, "").trim()
        : text;

    answer = normalizeBoldMarkup(answer);

    const status = /(?:don't know|do not know|cannot find|insufficient|not in context|need your order|please sign in)/i.test(answer)
        ? "EXCEPTION"
        : "ok";

    const sources = sourcesMatch
        ? sourcesMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    return { answer, status, sources };
};

const formatAllowedProducts = (products = []) => {
    if (!products.length) return "";
    return products
        .map((p, i) => {
            const moq = p.moq ? `, MOQ ${p.moq}` : "";
            return `${i + 1}. ${p.name || "Product"} — price ${p.price ?? "n/a"}${moq}`;
        })
        .join("\n");
};

const generateBuyerResponse = async ({
    userMessage,
    language = "en",
    chunks = [],
    conversationHistory = [],
    isLoggedIn = false,
    toolContext = "",
    answerHint = "",
    isProductFinding = false,
    catalogProducts = [],
} = {}) => {
    const productChunks = chunks.filter((c) => c.source === "product_docs");
    const contextBlock = formatContextBlock(chunks);
    const historyMessages = (conversationHistory || [])
        .slice(-4)
        .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
        }));

    const messages = [
        {
            role: "system",
            content: buildSystemPrompt(language, {
                hasProducts: productChunks.length > 0 || catalogProducts.length > 0,
                isLoggedIn,
                isProductFinding,
            }),
        },
        ...historyMessages,
        {
            role: "user",
            content: [
                `Context:\n${contextBlock}`,
                catalogProducts.length
                    ? `\nALLOWED_CATALOG_PRODUCTS (only these may be mentioned):\n${formatAllowedProducts(catalogProducts)}`
                    : "",
                toolContext ? `\nAgent actions:\n${toolContext}` : "",
                answerHint ? `\nGuidance: ${answerHint}` : "",
                `\nBuyer question:\n${userMessage}`,
            ].filter(Boolean).join("\n"),
        },
    ];

    const { content, model } = await chatCompletionWithFallback({
        model: ASSISTANT_MODEL(),
        messages,
        temperature: 0.3,
        max_tokens: Math.min(Number(process.env.BUYER_ASSISTANT_MAX_TOKENS || 550), 900),
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
    normalizeBoldMarkup,
};
