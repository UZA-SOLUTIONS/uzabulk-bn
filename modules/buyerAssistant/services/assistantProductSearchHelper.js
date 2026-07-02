const {
    extractProductTokens,
    normalizeProductTypos,
    stripIntentPrefixes,
} = require("./assistantIntentService");

const stripHtml = (value = "") =>
    String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&amp;|&lt;|&gt;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

const QUERY_CATEGORY_HINTS = [
    {
        id: "apparel_top",
        match: /\b(t-?shirts?|tee\s?shirts?|polo\s?shirts?|tank\s?tops?|blouses?)\b/i,
        productTerms: [
            /\bt-?shirts?\b/i,
            /\btee\b/i,
            /\bpolo\b/i,
            /\btank\s?top/i,
            /\bblouse/i,
            /\bapparel\b/i,
            /\bclothing\b/i,
            /\bgarmen/i,
        ],
        rejectTerms: [
            /\btea\b/i,
            /\bpill/i,
            /\bsesame\b/i,
            /\bmedlar\b/i,
            /\bmulberry\b/i,
            /\bginseng\b/i,
            /\btonic\b/i,
            /\bsupplement\b/i,
            /\bdrink\b/i,
            /\bbean\b/i,
            /\bblack\s*tea\b/i,
            /\bnourish/i,
            /\bwolfberry\b/i,
            /\bhealth\s*pill\b/i,
        ],
        minScore: 12,
    },
    {
        id: "footwear",
        match: /\b(shoes?|sneakers?|footwear|sandals?|boots?)\b/i,
        productTerms: [/\bshoe/i, /\bsneaker/i, /\bfootwear/i, /\bsandal/i, /\bboot/i],
        rejectTerms: [/\btea\b/i, /\bpill/i, /\bphone\s*case\b/i],
        minScore: 10,
    },
    {
        id: "bags",
        match: /\b(bags?|backpacks?|handbags?|totes?)\b/i,
        productTerms: [/\bbag/i, /\bbackpack/i, /\bhandbag/i, /\btote/i, /\bluggage/i],
        rejectTerms: [/\btea\s*bag\b/i],
        minScore: 10,
    },
];

const getCategoryHint = (searchQuery = "") => {
    const q = normalizeProductTypos(stripIntentPrefixes(searchQuery));
    return QUERY_CATEGORY_HINTS.find((hint) => hint.match.test(q)) || null;
};

const getProductText = (product = {}) => {
    const name = stripHtml(product.name || product.title || "");
    const desc = stripHtml(
        product.short_description
        || product.shortDescription
        || product.description
        || ""
    );
    return `${name} ${desc}`.toLowerCase();
};

const scoreProductForAssistantSearch = (product = {}, searchQuery = "") => {
    const text = getProductText(product);
    const name = stripHtml(product.name || product.title || "").toLowerCase();
    if (!text) return -100;

    const tokens = extractProductTokens(searchQuery);
    const hint = getCategoryHint(searchQuery);
    let score = 0;

    if (hint) {
        if (hint.rejectTerms.some((re) => re.test(text))) return -100;
        const categoryHit = hint.productTerms.some((re) => re.test(text));
        if (!categoryHit) return -50;
        score += 20;
    }

    tokens.forEach((token) => {
        if (name.includes(token)) score += 12;
        else if (text.includes(token)) score += 4;
    });

    if (tokens.length >= 2) {
        const allInName = tokens.every((token) => name.includes(token));
        if (allInName) score += 15;
    }

    return score;
};

const filterAssistantSearchProducts = (items = [], searchQuery = "", { limit = 3 } = {}) => {
    if (!Array.isArray(items) || !items.length || !searchQuery) {
        return (items || []).slice(0, limit);
    }

    const hint = getCategoryHint(searchQuery);
    const minScore = hint?.minScore || 8;

    return items
        .map((item) => ({ item, score: scoreProductForAssistantSearch(item, searchQuery) }))
        .filter((row) => row.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((row) => row.item);
};

const filterAssistantProductCards = (cards = [], searchQuery = "", options = {}) =>
    filterAssistantSearchProducts(cards, searchQuery, options);

const buildGroundedProductAnswer = (products = [], searchQuery = "", language = "en") => {
    const q = stripHtml(searchQuery) || "your search";
    const templates = {
        en: {
            none: `I searched our catalog for "<strong>${q}</strong>" but didn't find close matches. Try the <strong>Search</strong> button or a simpler keyword (e.g. t-shirt, shoes, phone case).`,
            intro: (n) => `Here ${n === 1 ? "is" : "are"} <strong>${n}</strong> catalog match${n === 1 ? "" : "es"} for "<strong>${q}</strong>":`,
            outro: "Tap a product card below for details, or use Search to browse more.",
        },
        fr: {
            none: `J'ai cherché "<strong>${q}</strong>" dans le catalogue sans résultat proche. Utilisez <strong>Search</strong> ou un mot-clé plus simple.`,
            intro: (n) => `Voici <strong>${n}</strong> résultat${n > 1 ? "s" : ""} pour "<strong>${q}</strong>" :`,
            outro: "Appuyez sur une fiche produit ci-dessous ou utilisez Search pour en voir plus.",
        },
    };
    const copy = templates[language] || templates.en;

    if (!products.length) {
        return copy.none;
    }

    const bullets = products.map((product) => {
        const name = stripHtml(product.name || "Product");
        const pricePart = product.price != null
            ? ` — <strong>${product.price}</strong> each`
            : "";
        const moqPart = product.moq
            ? `, MOQ <strong>${product.moq}</strong>`
            : "";
        return `• <strong>${name}</strong>${pricePart}${moqPart}`;
    }).join("<br/>");

    return `${copy.intro(products.length)}<br/>${bullets}<br/>${copy.outro}`;
};

module.exports = {
    stripHtml,
    getCategoryHint,
    scoreProductForAssistantSearch,
    filterAssistantSearchProducts,
    filterAssistantProductCards,
    buildGroundedProductAnswer,
};
