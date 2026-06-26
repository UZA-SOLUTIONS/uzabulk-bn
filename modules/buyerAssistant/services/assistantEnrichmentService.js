const { resolveProductImageUrl } = require("../../ai/helpers/resolveProductImageUrl");

const buildProductCard = (product = {}) => {
    if (!product?._id && !product?.id) return null;
    const id = String(product._id || product.id);
    const moq = product.min_order_qty || product.minQuantity || product.moq;

    return {
        id,
        name: product.name || "Product",
        price: product.price,
        comparePrice: product.compare_price,
        moq: moq || null,
        slug: product.slug || "",
        offerId: product.offerId ? String(product.offerId) : "",
        imageUrl: resolveProductImageUrl(product) || "",
        shortDescription: String(product.short_description || product.description || "").slice(0, 140),
        rating: product.average_rating,
        ratingCount: product.rating_count || 0,
        stockStatus: product.stock_status || "",
    };
};

const extractProductCards = (chunks = []) => {
    const seen = new Set();
    const cards = [];
    const isMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ""));

    for (const chunk of chunks) {
        const card = chunk.productCard
            || (chunk.productId ? { id: chunk.productId, name: chunk.title } : null);
        if (!card?.id || !isMongoId(card.id)) continue;
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        cards.push(card);
    }

    return cards.slice(0, 4);
};

const buildAssistantActions = ({
    message = "",
    retrieval = {},
    products = [],
    isLoggedIn = false,
} = {}) => {
    const actions = [];
    const seen = new Set();
    const q = String(message || "").toLowerCase();

    const push = (action) => {
        const key = `${action.type}:${action.route || action.productId || action.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        actions.push(action);
    };

    products.forEach((product) => {
        const shortName = String(product.name || "Product").slice(0, 28);
        push({
            type: "product",
            label: products.length > 1 ? `View: ${shortName}` : "View product",
            productId: product.id,
            offerId: product.offerId || "",
            name: product.name,
        });
    });

    if (retrieval.orderFound && retrieval.orderRef) {
        push({
            type: "navigate",
            label: "Track this order",
            route: "MY_ORDERS",
        });
        if (retrieval.orderId) {
            push({
                type: "navigate",
                label: "Order details",
                route: "ORDER_DETAIL",
                orderId: retrieval.orderId,
            });
        }
    }

    if (isLoggedIn) {
        if (/order|track|delivery|status|where is/.test(q)) {
            push({ type: "navigate", label: "My orders", route: "MY_ORDERS" });
        }
        if (/cart|basket|checkout/.test(q)) {
            push({ type: "navigate", label: "View cart", route: "CART" });
        }
        if (/address|shipping|deliver to/.test(q)) {
            push({ type: "navigate", label: "Saved addresses", route: "ORDER_ADDRESS" });
        }
        if (/profile|account|email|phone/.test(q)) {
            push({ type: "navigate", label: "My profile", route: "PROFILE" });
        }
    } else if (/order|cart|account|sign in|login/.test(q)) {
        push({ type: "navigate", label: "Sign in", route: "LOGIN" });
    }

    if (/search|find|browse|catalog|wholesale/.test(q) && !products.length) {
        push({ type: "navigate", label: "Browse products", route: "PRODUCT_LISTING" });
    }

    if (/contact|human|agent|support|help me|complaint/.test(q)) {
        push({ type: "navigate", label: "Contact support", route: "CONTACT_US" });
    }

    if (products.length && /moq|price|buy|order|add/.test(q)) {
        push({
            type: "chat",
            label: "How do I order this?",
            message: `How do I order ${products[0].name}? What is the MOQ and pricing?`,
        });
    }

    return actions.slice(0, 5);
};

module.exports = {
    buildProductCard,
    extractProductCards,
    buildAssistantActions,
};
