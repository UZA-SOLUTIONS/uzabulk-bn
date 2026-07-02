const { createPendingConfirmation } = require("./assistantConfirmationService");
const { hasSavedAddress } = require("./assistantCartService");

const advanceCheckoutWorkflow = async ({
    message = "",
    cartSnapshot = {},
    userId,
    session,
    language = "en",
} = {}) => {
    const workflow = session.context?.workflow || null;
    const itemCount = Number(cartSnapshot.itemCount || 0);

    if (itemCount <= 0) {
        return {
            workflow: null,
            step: "empty_cart",
            toolResults: [{
                tool: "checkout_workflow",
                status: "empty_cart",
                message: "Cart is empty",
            }],
            actions: [
                { type: "navigate", route: "PRODUCT_LISTING", label: "Browse products" },
            ],
            answerHint: "Your cart is empty. Browse products first, then I can help you checkout.",
        };
    }

    if (!userId) {
        return {
            workflow: { name: "checkout", step: "login_required" },
            step: "login_required",
            toolResults: [{ tool: "checkout_workflow", status: "login_required" }],
            actions: [
                { type: "navigate", route: "LOGIN", label: "Sign in to checkout" },
                { type: "navigate", route: "CART", label: "View cart" },
            ],
            answerHint: "Please sign in to continue checkout. I can show your cart in the meantime.",
        };
    }

    const hasAddress = await hasSavedAddress(userId);
    if (!hasAddress) {
        return {
            workflow: { name: "checkout", step: "address_required" },
            step: "address_required",
            toolResults: [{ tool: "checkout_workflow", status: "address_required" }],
            actions: [
                { type: "navigate", route: "ORDER_ADDRESS", label: "Add delivery address" },
                { type: "navigate", route: "CART", label: "Review cart" },
            ],
            answerHint: "You need a saved delivery address before checkout. Add one, then ask me to continue checkout.",
        };
    }

    const subTotal = cartSnapshot.subTotal || 0;
    const summary = `${itemCount} item(s), subtotal ${subTotal}`;

    const confirmation = createPendingConfirmation(session, {
        type: "navigate_checkout",
        params: {},
        label: `Proceed to checkout? (${summary})`,
        message: `Your cart has ${itemCount} item(s). Proceed to checkout?`,
        confirmLabel: language === "fr" ? "Oui, passer au paiement" : "Yes, go to checkout",
        cancelLabel: language === "fr" ? "Pas encore" : "Not yet",
    });

    return {
        workflow: { name: "checkout", step: "ready" },
        step: "ready",
        toolResults: [{
            tool: "checkout_workflow",
            status: "ready",
            itemCount,
            subTotal,
        }],
        confirmations: [confirmation],
        actions: [
            { type: "navigate", route: "CART", label: `Review cart (${itemCount} items)` },
        ],
        answerHint: `Your cart has ${itemCount} item(s). I can take you to checkout when you confirm.`,
    };
};

module.exports = {
    advanceCheckoutWorkflow,
};
