const STOP_WORDS = new Set([
    "i", "me", "my", "a", "an", "the", "some", "any", "please", "for", "and", "with",
    "need", "needs", "want", "wants", "require", "get", "find", "show", "buy", "purchase",
    "looking", "search", "searching", "source", "wholesale", "bulk", "have", "got", "do", "you",
    "check", "see", "view", "open", "look", "at", "in", "what", "whats",
]);

const PRODUCT_NEED_RE = /\b(?:i\s+)?(?:need|want|require|wants?|needs?)\b/i;
const PRODUCT_FIND_RE = /\b(?:looking\s+for|search(?:ing)?\s+for|find(?:ing)?|show\s+me|get(?:\s+me)?|source|buy|purchase)\b/i;
const PRODUCT_HAVE_RE = /\b(?:do\s+you\s+have|have\s+you\s+got|got\s+any)\b/i;

const CART_INTENT_RE = /\b(?:(?:check|show|see|view|open|look\s+at|what(?:'s| is))\s+(?:in\s+)?(?:my\s+)?(?:shopping\s+)?cart|(?:my\s+)?(?:shopping\s+)?cart(?:\s+(?:items|contents|summary|total))?|(?:items\s+in\s+my\s+cart)|(?:shopping\s+cart)|(?:basket))\b/i;

const ORDER_INTENT_RE = /\b(?:(?:check|show|see|view|track|where\s+is)\s+(?:my\s+)?(?:recent\s+)?orders?|(?:my\s+)?(?:recent\s+)?orders?|order\s+status|order\s+history|track(?:ing)?\s+(?:my\s+)?order)\b/i;

const ACCOUNT_INTENT_RE = /\b(?:(?:my\s+)?(?:profile|account|addresses?|saved\s+addresses?)|(?:sign\s*in|log\s*in))\b/i;

const normalizeProductTypos = (text = "") => {
    let out = String(text || "").toLowerCase();
    out = out.replace(/\btshit\b/g, "tshirt");
    out = out.replace(/\bt\s?-?\s?shirts?\b/g, "tshirt");
    out = out.replace(/\btee\s?-?\s?shirts?\b/g, "tshirt");
    out = out.replace(/\bcell\s?-?\s?phones?\b/g, "phone");
    return out.replace(/\s+/g, " ").trim();
};

const stripIntentPrefixes = (message = "") => {
    let text = normalizeProductTypos(String(message || "").trim());
    text = text
        .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:help\s+me\s+)?(?:i\s+)?(?:need|want|require|wants?|needs?)\s+(?:to\s+(?:find|get|buy|source)\s+)?/i, "")
        .replace(/^(?:please\s+)?(?:i\s+)?(?:am\s+)?(?:looking\s+for|search(?:ing)?\s+for|trying\s+to\s+find)\s+/i, "")
        .replace(/^(?:please\s+)?(?:find|show|get)(?:\s+me)?\s+/i, "")
        .replace(/^(?:do\s+you\s+have|have\s+you\s+got|got\s+any)\s+/i, "")
        .replace(/^(?:some|a|an|the)\s+/i, "")
        .trim();
    return text;
};

const extractProductTokens = (message = "") => {
    const stripped = stripIntentPrefixes(message);
    return stripped
        .split(/\s+/)
        .map((word) => word.replace(/[^\w-]/g, ""))
        .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
};

const isAccountIntentQuery = (query = "") => {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return false;

    if (CART_INTENT_RE.test(q) || ORDER_INTENT_RE.test(q) || ACCOUNT_INTENT_RE.test(q)) {
        return true;
    }

    return /^(?:what(?:'s| is)\s+in\s+my\s+cart|my\s+cart|my\s+orders?|track\s+my\s+order|order\s+status|where\s+is\s+my\s+order)\b/.test(q)
        || (/^(?:my\s+)?(?:cart|orders?|address|profile|account)\b/.test(q)
            && !/(product|price|moq|tshirt|shirt|shoe|bag|phone|wholesale|black|white|red|blue)/i.test(q));
};

const isAccountOnlyQuery = isAccountIntentQuery;

const isCartIntentQuery = (query = "") => CART_INTENT_RE.test(String(query || "").toLowerCase());

const isCheckProductQuery = (message = "") => {
    const q = String(message || "").toLowerCase().trim();
    if (CART_INTENT_RE.test(q) || ORDER_INTENT_RE.test(q)) return false;
    if (!/\b(?:check|look\s+up|lookup)\b/i.test(q)) return false;

    const remainder = q
        .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:help\s+me\s+)?/i, "")
        .replace(/^\b(?:check|look\s+up|lookup)\b\s+(?:on\s+|for\s+|if\s+(?:you\s+)?have\s+)?/i, "")
        .trim();

    if (!remainder || /^(?:my\s+)?(?:cart|orders?|checkout)\b/.test(remainder)) {
        return false;
    }

    return extractProductTokens(remainder).length >= 1;
};

const extractCheckProductQuery = (message = "") => {
    const match = String(message || "").match(
        /(?:check|look\s+up|lookup)\s+(?:on\s+|for\s+|if\s+(?:you\s+)?have\s+)?(.+)/i
    );
    if (match?.[1]) {
        const cleaned = stripIntentPrefixes(match[1]);
        if (cleaned.length >= 2) return cleaned.slice(0, 120);
    }
    return "";
};

const isProductFindingQuery = (query = "", productId = "") => {
    if (productId) return false;

    const q = String(query || "").trim().toLowerCase();
    if (q.length < 3) return false;
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye|good\s*(morning|afternoon|evening))\b/.test(q)) {
        return false;
    }
    if (isCheckProductQuery(q)) return true;
    if (isAccountIntentQuery(q)) return false;

    if (PRODUCT_NEED_RE.test(q) || PRODUCT_FIND_RE.test(q) || PRODUCT_HAVE_RE.test(q)) {
        return extractProductTokens(q).length >= 1;
    }

    const tokens = extractProductTokens(q);
    if (tokens.length >= 2) return true;

    const productHint = /(product|price|moq|cost|item|stock|wholesale|sku|offer|catalog|tshirt|shirt|shoe|bag|phone|dress|watch|lamp|table|chair)/i.test(q);
    if (productHint && tokens.length >= 1) return true;

    return false;
};

const extractSearchQuery = (message = "") => {
    if (isCheckProductQuery(message)) {
        return extractCheckProductQuery(message) || stripIntentPrefixes(message).slice(0, 120);
    }
    if (isAccountIntentQuery(message)) return "";

    const text = String(message || "").trim();
    const patterns = [
        /(?:search|find|look(?:ing)?\s*for|show\s*me|browse)\s+(?:for\s+)?(.+)/i,
        /(?:products?\s+(?:like|named|called))\s+(.+)/i,
        /(?:i\s+)?(?:need|want|require)\s+(?:to\s+(?:find|get|buy|source)\s+)?(.+)/i,
        /(?:do\s+you\s+have|got\s+any)\s+(.+)/i,
    ];

    for (const re of patterns) {
        const match = text.match(re);
        if (match?.[1]) {
            const cleaned = stripIntentPrefixes(match[1]);
            if (cleaned.length >= 2 && !isAccountIntentQuery(cleaned)) {
                return cleaned.slice(0, 120);
            }
        }
    }

    const stripped = stripIntentPrefixes(text);
    if (stripped.length >= 2 && isProductFindingQuery(text) && !isAccountIntentQuery(stripped)) {
        return stripped.slice(0, 120);
    }

    return "";
};

const detectAssistantIntent = (message = "", context = {}) => {
    const q = String(message || "").toLowerCase().trim();
    const intents = [];
    const accountIntent = isAccountIntentQuery(q) && !isCheckProductQuery(message);

    if (CART_INTENT_RE.test(q)) {
        intents.push("cart");
    } else if (/my\s*cart|what('s| is)\s*in\s*(my\s*)?cart|cart\s*items|basket/.test(q)) {
        intents.push("cart");
    }

    if (/checkout|check\s*out(?!\s+my\s+cart)|pay\s*now|complete\s*(my\s*)?(order|purchase)|proceed\s*to\s*pay/.test(q)) {
        intents.push("checkout");
    }
    if (/add\s*(to|into)\s*cart|put\s*(this|it)\s*in\s*(my\s*)?cart|buy\s*this|order\s*this|add\s*this/.test(q)) {
        intents.push("add_to_cart");
    }

    if (!accountIntent && isProductFindingQuery(message)) {
        intents.push("find_product");
    }
    if (!accountIntent && /search|find|look\s*for|show\s*me|browse|looking\s*for/.test(q)) {
        intents.push("search");
    }

    if (ORDER_INTENT_RE.test(q) || /track|where\s*is\s*my\s*order|order\s*status|delivery\s*status|shipping\s*update/.test(q)) {
        intents.push("order");
    }
    if (/address|deliver\s*to|shipping\s*address/.test(q)) {
        intents.push("address");
    }
    if (/sign\s*in|log\s*in|my\s*account|profile/.test(q)) {
        intents.push("account");
    }
    if (/human|agent|support|complaint|escalate|speak\s*to\s*someone/.test(q)) {
        intents.push("escalate");
    }

    if (context.workflow?.name === "checkout" && /yes|continue|next|proceed|go\s*ahead|ok(ay)?/.test(q)) {
        intents.unshift("checkout_continue");
    }

    return {
        primary: intents[0] || "general",
        all: intents,
        isProductFinding: !accountIntent && isProductFindingQuery(message),
        isAccountIntent: accountIntent,
        isCartIntent: isCartIntentQuery(q) || intents.includes("cart"),
    };
};

const extractQuantity = (message = "") => {
    const text = String(message || "");
    const patterns = [
        /\badd\s+(\d{1,6})\b/i,
        /\b(\d{1,6})\s*(?:units|pcs|pieces|items|qty|x)\b/i,
        /\bquantity\s*(?:of|:)?\s*(\d{1,6})\b/i,
    ];
    for (const re of patterns) {
        const match = text.match(re);
        if (match?.[1]) {
            const qty = Number(match[1]);
            if (qty > 0 && qty <= 999999) return qty;
        }
    }
    return null;
};

module.exports = {
    detectAssistantIntent,
    extractSearchQuery,
    extractQuantity,
    extractProductTokens,
    stripIntentPrefixes,
    normalizeProductTypos,
    isProductFindingQuery,
    isAccountOnlyQuery,
    isAccountIntentQuery,
    isCartIntentQuery,
    isCheckProductQuery,
    extractCheckProductQuery,
    CART_INTENT_RE,
    ORDER_INTENT_RE,
};
