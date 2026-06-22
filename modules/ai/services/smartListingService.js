const { getDashscopeClient, isDashscopeConfigured } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { chatCompletionWithFallback } = require("./chatWithFallback");
const { getVisionModel, getConfiguredChatModel } = require("../helpers/resolveChatModel");
const { resolveVisionImageInput } = require("../helpers/resolveVisionImageInput");
const {
    TARGET_MARKETS_DEFAULT,
    normalizeBuyerAttributes,
    buildListingSourceContext,
} = require("../helpers/productAttributes");

const VL_MODEL = () => getVisionModel();
const TEXT_MODEL = () => getConfiguredChatModel();

const BUYER_VL_PROMPT = (targetMarket = "East Africa wholesale buyers") => [
    "You are a product attribute extractor. Return ONLY valid JSON, no prose.",
    "Schema:",
    "{",
    '  "category": string,',
    '  "color": string[],',
    '  "material": string,',
    '  "style_keywords": string[],',
    '  "condition": "new|used",',
    '  "estimated_price_usd": number,',
    '  "product_type": string,',
    '  "visible_text": string',
    "}",
    `Target market: ${targetMarket}.`,
    "Analyze this product image and fill the schema above.",
].join("\n");

/**
 * Step 1: Qwen-VL — extract structured attributes from product image.
 * @param {string} imageUrl — public HTTPS URL
 * @param {{ targetMarket?: string }} options
 */
const analyzeProductImage = async (imageUrl, { targetMarket = "East Africa wholesale buyers" } = {}) => {
    if (!isDashscopeConfigured()) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }
    const url = String(imageUrl || "").trim();
    if (!url) throw new Error("imageUrl is required");

    const visionImage = await resolveVisionImageInput(url);
    const client = getDashscopeClient();
    const response = await client.chat.completions.create({
        model: VL_MODEL(),
        messages: [{
            role: "user",
            content: [
                visionImage,
                { type: "text", text: BUYER_VL_PROMPT(targetMarket) },
            ],
        }],
        temperature: 0.2,
    });

    const content = response.choices?.[0]?.message?.content || "";
    return normalizeBuyerAttributes(parseJsonFromLlm(content));
};

/**
 * Step 2: Qwen text model — generate multilingual listing copy for buyer display.
 * @param {object} attributes — VL-extracted attributes
 * @param {object|number} sourceContext — listing context or legacy sourcePriceCNY number
 */
const generateListing = async (attributes, sourceContext = {}) => {
    if (!isDashscopeConfigured()) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }

    const context = typeof sourceContext === "number" || typeof sourceContext === "string"
        ? buildListingSourceContext({ sourcePriceCNY: sourceContext })
        : buildListingSourceContext(sourceContext);

    const priceLine = context.sourcePriceCNY != null
        ? `Source price: ${context.sourcePriceCNY} CNY per unit at MOQ ${context.minOrderQty || 1}`
        : "Source price: unknown";

    const { content, model } = await chatCompletionWithFallback({
        messages: [
            {
                role: "system",
                content: [
                    "You are a product copywriter for an African wholesale marketplace.",
                    "Always write for bulk buyers (MOQ 10+), not individual consumers.",
                    "Return JSON only (no markdown):",
                    "{",
                    '  "title_en": string (max 80 chars),',
                    '  "title_fr": string,',
                    '  "description_en": string (max 200 chars),',
                    '  "description_fr": string,',
                    '  "seo_tags": string[] (max 8),',
                    '  "price_usd_suggestion": number,',
                    '  "moq_suggestion": number',
                    "}",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    context.subjectCn ? `Source title (Chinese): ${context.subjectCn}` : "",
                    context.categoryMapped ? `Category: ${context.categoryMapped}` : "",
                    priceLine,
                    context.skuProps ? `Key attributes: ${context.skuProps}` : "",
                    `Product attributes from image: ${JSON.stringify(attributes)}`,
                    `Target market: ${context.targetMarkets || TARGET_MARKETS_DEFAULT}`,
                ].filter(Boolean).join("\n"),
            },
        ],
        temperature: 0.5,
    });

    const listing = parseJsonFromLlm(content);
    listing._model_used = model;
    return listing;
};

/**
 * Full smart-listing pipeline: image → attributes → listing JSON.
 */
const runSmartListing = async ({ imageUrl, sourcePriceCNY, sourceContext = {} } = {}) => {
    const context = buildListingSourceContext({
        ...sourceContext,
        sourcePriceCNY: sourceContext.sourcePriceCNY ?? sourcePriceCNY,
    });
    const attributes = await analyzeProductImage(imageUrl, {
        targetMarket: context.targetMarkets || TARGET_MARKETS_DEFAULT,
    });
    const listing = await generateListing(attributes, context);
    return {
        attributes,
        listing,
        models: {
            vision: VL_MODEL(),
            text: TEXT_MODEL(),
        },
    };
};

module.exports = {
    analyzeProductImage,
    generateListing,
    runSmartListing,
    isDashscopeConfigured,
};
