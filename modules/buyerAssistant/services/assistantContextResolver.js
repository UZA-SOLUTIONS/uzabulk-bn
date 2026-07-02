const {
    extractSearchQuery,
    extractProductTokens,
    stripIntentPrefixes,
    normalizeProductTypos,
    isAccountIntentQuery,
    isProductFindingQuery,
    isCartIntentQuery,
    isCheckProductQuery,
    CART_INTENT_RE,
    ORDER_INTENT_RE,
} = require("./assistantIntentService");

const extractIncidentalProductQuery = (message = "") => {
    let q = String(message || "").toLowerCase();
    q = q.replace(CART_INTENT_RE, " ").replace(ORDER_INTENT_RE, " ").replace(/\bcheckout\b/gi, " ");
    q = stripIntentPrefixes(q);
    q = normalizeProductTypos(q).trim();

    if (!q || isAccountIntentQuery(q)) return "";
    if (extractProductTokens(q).length < 1) return "";

    return q.slice(0, 120);
};

const hasOrderHistory = (retrieval = {}) => {
    if (retrieval.orderFound) return true;
    const orderChunk = (retrieval.chunks || []).find((c) => c.source === "order_history");
    if (!orderChunk?.text) return false;
    return !/no orders on record/i.test(orderChunk.text);
};

const resolveAssistantMode = ({
    message = "",
    intent = {},
    cartSnapshot = {},
    retrieval = {},
    userId = null,
    isLoggedIn = false,
} = {}) => {
    const cartCount = Number(cartSnapshot.itemCount || 0);
    const cartIntent = Boolean(intent.isCartIntent || intent.all?.includes("cart") || isCartIntentQuery(message));
    const orderIntent = Boolean(intent.all?.includes("order") || ORDER_INTENT_RE.test(String(message || "").toLowerCase()));
    const checkoutIntent = Boolean(intent.all?.includes("checkout") || intent.primary === "checkout_continue");

    if (isCheckProductQuery(message)) {
        return {
            mode: "product_search",
            searchQuery: extractSearchQuery(message),
            allowProductCards: true,
        };
    }

    if (checkoutIntent && !cartIntent) {
        const searchQuery = extractIncidentalProductQuery(message);
        if (cartCount <= 0) {
            return {
                mode: searchQuery ? "checkout_empty_search" : "checkout_empty",
                searchQuery,
                allowProductCards: Boolean(searchQuery),
            };
        }
        return { mode: "checkout", searchQuery: "", allowProductCards: false };
    }

    if (cartIntent) {
        if (cartCount > 0) {
            return { mode: "cart", searchQuery: "", allowProductCards: false };
        }
        const searchQuery = extractIncidentalProductQuery(message);
        return {
            mode: searchQuery ? "cart_empty_search" : "cart_empty",
            searchQuery,
            allowProductCards: Boolean(searchQuery),
        };
    }

    if (orderIntent) {
        if (hasOrderHistory(retrieval)) {
            return { mode: "order", searchQuery: "", allowProductCards: false };
        }
        const searchQuery = extractIncidentalProductQuery(message);
        return {
            mode: searchQuery ? "order_empty_search" : "order_empty",
            searchQuery,
            allowProductCards: Boolean(searchQuery),
        };
    }

    if (!intent.isAccountIntent && isProductFindingQuery(message)) {
        return {
            mode: "product_search",
            searchQuery: extractSearchQuery(message),
            allowProductCards: true,
        };
    }

    return { mode: "general", searchQuery: "", allowProductCards: false };
};

const buildGroundedOrderEmptyAnswer = (language = "en", isLoggedIn = false) => {
    const copy = {
        en: {
            guest: "Sign in to see your order history and tracking updates.",
            empty: "You don't have any orders yet. When you're ready, tell me what to source and I'll search the catalog — or browse products to get started.",
        },
        fr: {
            guest: "Connectez-vous pour voir vos commandes.",
            empty: "Vous n'avez pas encore de commandes. Dites-moi ce que vous cherchez et je parcourrai le catalogue.",
        },
    };
    const t = copy[language] || copy.en;
    return isLoggedIn ? t.empty : `${t.guest}<br/>${t.empty}`;
};

const buildGroundedCheckoutEmptyAnswer = (language = "en", { hasSearch = false } = {}) => {
    const copy = {
        en: {
            base: "Your cart is empty, so checkout isn't available yet.",
            search: "Your cart is empty. Here are some products you might add first:",
            hint: "Add items to your cart, then ask me to <strong>help you checkout</strong>.",
        },
        fr: {
            base: "Votre panier est vide — le paiement n'est pas encore possible.",
            search: "Votre panier est vide. Voici des produits à ajouter d'abord :",
            hint: "Ajoutez des articles, puis demandez de l'aide pour le checkout.",
        },
    };
    const t = copy[language] || copy.en;
    return hasSearch ? t.search : `${t.base}<br/>${t.hint}`;
};

const buildCartEmptyWithSearchAnswer = ({
    cartSnapshot = {},
    products = [],
    searchQuery = "",
    language = "en",
    isLoggedIn = false,
} = {}) => {
    const { buildGroundedCartAnswer } = require("./assistantCartService");
    const { buildGroundedProductAnswer } = require("./assistantProductSearchHelper");

    const emptyLine = buildGroundedCartAnswer(cartSnapshot, language, isLoggedIn);
    if (!products.length) {
        return `${emptyLine}<br/>${buildGroundedProductAnswer([], searchQuery, language)}`;
    }
    return `${emptyLine}<br/>${buildGroundedProductAnswer(products, searchQuery, language)}`;
};

const buildOrderEmptyWithSearchAnswer = ({
    products = [],
    searchQuery = "",
    language = "en",
    isLoggedIn = false,
} = {}) => {
    const { buildGroundedProductAnswer } = require("./assistantProductSearchHelper");
    const intro = buildGroundedOrderEmptyAnswer(language, isLoggedIn);
    if (!products.length) {
        return `${intro}<br/>${buildGroundedProductAnswer([], searchQuery, language)}`;
    }
    return `${intro}<br/>${buildGroundedProductAnswer(products, searchQuery, language)}`;
};

const buildCheckoutEmptyWithSearchAnswer = ({
    products = [],
    searchQuery = "",
    language = "en",
} = {}) => {
    const { buildGroundedProductAnswer } = require("./assistantProductSearchHelper");
    const intro = buildGroundedCheckoutEmptyAnswer(language, { hasSearch: true });
    if (!products.length) {
        return `${intro}<br/>${buildGroundedProductAnswer([], searchQuery, language)}`;
    }
    return `${intro}<br/>${buildGroundedProductAnswer(products, searchQuery, language)}`;
};

const buildEmptyContextActions = (mode = "cart_empty", language = "en") => {
    const actions = [
        { type: "navigate", route: "PRODUCT_LISTING", label: "Browse products" },
        {
            type: "chat",
            label: language === "fr" ? "Trouver un produit" : "Help me find a product",
            message: "Help me find a product",
        },
    ];

    if (mode === "checkout_empty" || mode === "cart_empty") {
        actions.push({
            type: "chat",
            label: language === "fr" ? "Aide checkout" : "Help me checkout",
            message: "Help me checkout",
        });
    }

    if (mode === "order_empty") {
        actions.unshift({
            type: "navigate",
            route: "MY_ORDERS",
            label: "My orders",
        });
    }

    return actions;
};

module.exports = {
    isCheckProductQuery,
    extractIncidentalProductQuery,
    resolveAssistantMode,
    hasOrderHistory,
    buildGroundedOrderEmptyAnswer,
    buildGroundedCheckoutEmptyAnswer,
    buildCartEmptyWithSearchAnswer,
    buildOrderEmptyWithSearchAnswer,
    buildCheckoutEmptyWithSearchAnswer,
    buildEmptyContextActions,
};
