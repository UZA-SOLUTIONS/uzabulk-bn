const Product = require("../../../models/productsTable");
const { isValidObjectId } = require("../../../validators/validator");
const {
    detectAssistantIntent,
    extractSearchQuery,
    extractQuantity,
    extractProductTokens,
} = require("./assistantIntentService");
const { resolveAssistantMode, buildEmptyContextActions } = require("./assistantContextResolver");
const { getCartSnapshot } = require("./assistantCartService");
const { createPendingConfirmation } = require("./assistantConfirmationService");
const { advanceCheckoutWorkflow } = require("./assistantWorkflowService");
const { buildProductCard } = require("./assistantEnrichmentService");
const { filterAssistantSearchProducts, getCategoryHint } = require("./assistantProductSearchHelper");
const { extractOrderRef } = require("./knowledgeRetrievalService");

const lazyCatalogSearch = () => {
    try {
        return require("../../products/services/catalogSearchService").searchCatalogByText;
    } catch {
        return null;
    }
};

const resolveTargetProductId = ({
    message,
    productId,
    session,
    retrieval,
} = {}) => {
    if (productId && isValidObjectId(productId)) return String(productId);
    if (session.context?.lastProductId && isValidObjectId(session.context.lastProductId)) {
        return String(session.context.lastProductId);
    }
    if (retrieval?.productId && isValidObjectId(retrieval.productId)) {
        return String(retrieval.productId);
    }
    const ref = extractOrderRef(message);
    if (ref && isValidObjectId(ref)) return ref;
    return "";
};

const buildCatalogSearchPhrase = (searchQuery = "") => {
    const hint = getCategoryHint(searchQuery);
    const tokens = extractProductTokens(searchQuery);
    if (hint?.id === "apparel_top") {
        const colorTokens = tokens.filter((t) => !/tshirt|shirt|tee|polo/.test(t));
        return ["t-shirt", ...colorTokens].filter(Boolean).join(" ");
    }
    return searchQuery;
};

const runCatalogSearch = async ({
    searchQuery,
    extraProducts,
    actions,
    toolResults,
    limit = 4,
} = {}) => {
    if (!searchQuery) return 0;

    const label = searchQuery.length > 28 ? `${searchQuery.slice(0, 28)}…` : searchQuery;
    actions.push({
        type: "search",
        query: searchQuery,
        label: `Search "${label}"`,
    });
    toolResults.push({ tool: "search_products", status: "ok", query: searchQuery });

    const searchFn = lazyCatalogSearch();
    if (!searchFn) return 0;

    try {
        const catalogPhrase = buildCatalogSearchPhrase(searchQuery);
        const searchResult = await searchFn({
            search: catalogPhrase,
            limit: Math.max(limit * 4, 12),
            skip: 1,
            skipExternal: true,
        });
        let filtered = filterAssistantSearchProducts(
            searchResult?.items || [],
            searchQuery,
            { limit: 3 }
        );

        if (!filtered.length && catalogPhrase !== searchQuery) {
            const retryResult = await searchFn({
                search: searchQuery,
                limit: Math.max(limit * 4, 12),
                skip: 1,
                skipExternal: true,
            });
            filtered = filterAssistantSearchProducts(retryResult?.items || [], searchQuery, { limit: 3 });
        }

        let added = 0;
        filtered.forEach((item) => {
            const card = buildProductCard(item);
            if (card && !extraProducts.some((row) => row.id === card.id)) {
                extraProducts.push(card);
                added += 1;
            }
        });
        toolResults[toolResults.length - 1].matchCount = added;
        return added;
    } catch (error) {
        console.warn("[buyer-assistant] search tool failed:", error?.message || error);
        return 0;
    }
};

const formatToolContext = (toolResults = []) => {
    if (!toolResults.length) return "";
    return toolResults
        .map((row) => `[Tool ${row.tool}] ${row.status}${row.message ? `: ${row.message}` : ""}`)
        .join("\n");
};

const runAssistantTools = async ({
    message = "",
    userId,
    deviceId,
    productId,
    retrieval = {},
    session,
    language = "en",
    isLoggedIn = false,
} = {}) => {
    const intent = detectAssistantIntent(message, { workflow: session.context?.workflow });
    const toolResults = [];
    const actions = [];
    const confirmations = [];
    let extraProducts = [];
    let workflowUpdate = null;
    let answerHint = "";

    const cartSnapshot = await getCartSnapshot({ userId, deviceId });

    const mode = resolveAssistantMode({
        message,
        intent,
        cartSnapshot,
        retrieval,
        userId,
        isLoggedIn,
    });

    if (intent.all.includes("cart") || intent.all.includes("checkout") || mode.mode.startsWith("cart") || mode.mode.startsWith("checkout")) {
        toolResults.push({
            tool: "get_cart",
            status: cartSnapshot.itemCount ? "ok" : "empty",
            itemCount: cartSnapshot.itemCount,
            subTotal: cartSnapshot.subTotal,
        });
    }

    if (intent.all.includes("add_to_cart")) {
        const targetProductId = resolveTargetProductId({ message, productId, session, retrieval });
        if (targetProductId) {
            const product = await Product.findById(targetProductId)
                .select("name price min_order_qty type status offerId slug featured_image short_description compare_price average_rating rating_count stock_status")
                .populate({ path: "featured_image", select: "link -_id" })
                .lean();

            if (product && product.status === "active") {
                const moq = Math.max(Number(product.min_order_qty || 1), 1);
                const quantity = extractQuantity(message) || moq;
                const card = buildProductCard(product);
                if (card) extraProducts.push(card);

                confirmations.push(createPendingConfirmation(session, {
                    type: "add_to_cart",
                    params: { productId: targetProductId, quantity },
                    message: `Add <strong>${quantity}× ${product.name}</strong> to your cart?`,
                    confirmLabel: language === "fr" ? "Oui, ajouter au panier" : "Yes, add to cart",
                    cancelLabel: language === "fr" ? "Annuler" : "Cancel",
                }));

                toolResults.push({
                    tool: "add_to_cart",
                    status: "pending_confirmation",
                    productId: targetProductId,
                    quantity,
                    productName: product.name,
                });
                answerHint = `I can add ${quantity}× ${product.name} to your cart — please confirm below.`;
            } else {
                toolResults.push({ tool: "add_to_cart", status: "product_not_found" });
            }
        } else {
            toolResults.push({ tool: "add_to_cart", status: "missing_product" });
            answerHint = "Open a product page or tell me which product to add, then ask again.";
        }
    }

    if (intent.all.includes("checkout") || intent.primary === "checkout_continue") {
        const checkout = await advanceCheckoutWorkflow({
            message,
            cartSnapshot,
            userId,
            session,
            language,
        });
        workflowUpdate = checkout.workflow;
        toolResults.push(...(checkout.toolResults || []));
        if (checkout.confirmations?.length) confirmations.push(...checkout.confirmations);
        if (checkout.actions?.length) actions.push(...checkout.actions);
        if (checkout.answerHint) answerHint = checkout.answerHint;
    }

    const shouldSearch = mode.allowProductCards && mode.searchQuery;
    if (shouldSearch) {
        const matchCount = await runCatalogSearch({
            searchQuery: mode.searchQuery,
            extraProducts,
            actions,
            toolResults,
        });

        if (matchCount > 0) {
            answerHint = "Use ONLY the product cards shown — do not invent other products.";
        } else if (mode.mode === "product_search") {
            answerHint = "No relevant catalog matches — suggest Search or a simpler keyword.";
        }
    } else if (
        !intent.isAccountIntent
        && (intent.all.includes("find_product") || intent.all.includes("search"))
    ) {
        const searchQuery = extractSearchQuery(message);
        if (searchQuery) {
            const matchCount = await runCatalogSearch({
                searchQuery,
                extraProducts,
                actions,
                toolResults,
            });

            if (matchCount > 0) {
                answerHint = "Use ONLY the product cards shown — do not invent other products.";
            } else {
                answerHint = "No relevant catalog matches after filtering — tell the buyer honestly and suggest Search.";
            }
        }
    }

    const emptyContextMode = mode.mode.replace(/_search$/, "");
    if (["cart_empty", "checkout_empty", "order_empty"].includes(emptyContextMode)) {
        const emptyActions = buildEmptyContextActions(emptyContextMode, language);
        if (mode.mode.endsWith("_search") && extraProducts.length) {
            emptyActions
                .filter((action) => action.type === "navigate" && action.route === "PRODUCT_LISTING")
                .forEach((action) => actions.push(action));
        } else {
            emptyActions.forEach((action) => actions.push(action));
        }
    }

    if (intent.all.includes("order") && retrieval.orderFound) {
        toolResults.push({
            tool: "get_order_status",
            status: "ok",
            orderRef: retrieval.orderRef,
            orderId: retrieval.orderId,
        });
    }

    if (intent.all.includes("escalate")) {
        toolResults.push({ tool: "escalate", status: "suggested" });
        actions.push({ type: "navigate", route: "CONTACT_US", label: "Contact support" });
    }

    if (!isLoggedIn && /checkout|cart|order|add/.test(String(message).toLowerCase())) {
        actions.push({ type: "navigate", route: "LOGIN", label: "Sign in" });
    }

    return {
        intent,
        mode,
        toolResults,
        actions,
        confirmations,
        extraProducts,
        workflowUpdate,
        answerHint,
        cartSnapshot,
        toolContext: formatToolContext(toolResults),
    };
};

module.exports = {
    runAssistantTools,
    formatToolContext,
};
