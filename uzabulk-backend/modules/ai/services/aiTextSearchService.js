const { isDashscopeConfigured } = require("../dashscopeClient");
const { parseJsonFromLlm } = require("../helpers/parseJsonFromLlm");
const { chatCompletionWithFallback } = require("./chatWithFallback");

const isAiTextSearchEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(env?.dashscope?.AI_TEXT_SEARCH ?? env?.dashscope?.AI_SEARCH ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

const uniqueTerms = (terms = []) => {
    const seen = new Set();
    const out = [];
    terms.forEach((raw) => {
        const term = normalizeTerm(raw);
        if (!term || term.length < 2 || seen.has(term)) return;
        seen.add(term);
        out.push(term);
    });
    return out;
};

/**
 * Expand a shopper search query into wholesale-friendly keywords (qwen-plus).
 */
const expandSearchQuery = async (search = "") => {
    const original = normalizeTerm(search);
    if (!original) {
        return { primary: "", keywords: [], original, aiExpanded: false };
    }
    if (!isAiTextSearchEnabled()) {
        return { primary: original, keywords: [original], original, aiExpanded: false };
    }

    const { content } = await chatCompletionWithFallback({
        messages: [{
            role: "user",
            content: [
                "You help B2B wholesale buyers search a product catalog.",
                `User query: "${original}"`,
                "Return JSON only (no markdown):",
                "{",
                '  "primary": string,',
                '  "keywords": string[]',
                "}",
                "primary = best single English catalog search phrase.",
                "keywords = up to 6 useful variants (synonyms, plural, category terms, FR/EN mix ok).",
            ].join("\n"),
        }],
        temperature: 0.2,
    });

    const parsed = parseJsonFromLlm(content);
    const primary = normalizeTerm(parsed?.primary || original);
    const keywords = uniqueTerms([
        primary,
        original,
        ...(Array.isArray(parsed?.keywords) ? parsed.keywords : []),
    ]);

    return {
        primary: primary || original,
        keywords: keywords.length ? keywords : [original],
        original,
        aiExpanded: true,
    };
};

module.exports = {
    isAiTextSearchEnabled,
    expandSearchQuery,
    uniqueTerms,
};
