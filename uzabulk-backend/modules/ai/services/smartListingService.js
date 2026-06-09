const { getDashscopeClient, isDashscopeConfigured } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { chatCompletionWithFallback } = require("./chatWithFallback");
const { getVisionModel, getConfiguredChatModel } = require("../helpers/resolveChatModel");
const { resolveVisionImageInput } = require("../helpers/resolveVisionImageInput");

const VL_MODEL = () => getVisionModel();
const TEXT_MODEL = () => getConfiguredChatModel();

/**
 * Step 1: Qwen-VL — extract structured attributes from product image.
 * @param {string} imageUrl — public HTTPS URL
 */
const analyzeProductImage = async (imageUrl) => {
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
                {
                    type: "text",
                    text: [
                        "You are a wholesale product catalog assistant.",
                        "Extract from this product image and return JSON only (no markdown):",
                        "{",
                        '  "category": string,',
                        '  "color": string,',
                        '  "material": string,',
                        '  "size": string,',
                        '  "condition": string,',
                        '  "product_type": string,',
                        '  "visible_text": string',
                        "}",
                    ].join("\n"),
                },
            ],
        }],
        temperature: 0.2,
    });

    const content = response.choices?.[0]?.message?.content || "";
    return parseJsonFromLlm(content);
};

/**
 * Step 2: Qwen text model — generate multilingual listing copy.
 */
const generateListing = async (attributes, sourcePriceCNY = null) => {
    if (!isDashscopeConfigured()) {
        throw new Error("DASHSCOPE_API_KEY is not configured");
    }

    const priceLine = sourcePriceCNY != null && sourcePriceCNY !== ""
        ? `Source price: ${sourcePriceCNY} CNY`
        : "Source price: unknown";

    const { content, model } = await chatCompletionWithFallback({
        messages: [{
            role: "user",
            content: [
                "Generate a B2B wholesale product listing for UZA Bulk marketplace.",
                `Product attributes: ${JSON.stringify(attributes)}`,
                priceLine,
                "Return JSON only (no markdown):",
                "{",
                '  "title_en": string,',
                '  "title_fr": string,',
                '  "description_en": string,',
                '  "description_fr": string,',
                '  "seo_tags": string[],',
                '  "price_usd_suggestion": number,',
                '  "moq_suggestion": number',
                "}",
            ].join("\n"),
        }],
        temperature: 0.5,
    });

    const listing = parseJsonFromLlm(content);
    listing._model_used = model;
    return listing;
};

/**
 * Full smart-listing pipeline: image → attributes → listing JSON.
 */
const runSmartListing = async ({ imageUrl, sourcePriceCNY } = {}) => {
    const attributes = await analyzeProductImage(imageUrl);
    const listing = await generateListing(attributes, sourcePriceCNY);
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
