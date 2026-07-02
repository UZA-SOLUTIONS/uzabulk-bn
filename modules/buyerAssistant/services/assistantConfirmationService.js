const { v4: uuidv4 } = require("uuid");
const { addProductToBuyerCart } = require("./assistantCartService");

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

const SENSITIVE_ACTION_TYPES = new Set([
    "add_to_cart",
    "navigate_checkout",
]);

const isSensitiveAction = (type) => SENSITIVE_ACTION_TYPES.has(type);

const pruneExpiredConfirmations = (pending = {}) => {
    const now = Date.now();
    const next = {};
    Object.entries(pending || {}).forEach(([id, row]) => {
        if (row?.expiresAt && row.expiresAt > now) next[id] = row;
    });
    return next;
};

const createPendingConfirmation = (session, {
    type,
    params = {},
    label = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    message = "",
} = {}) => {
    const confirmationId = uuidv4();
    const pending = pruneExpiredConfirmations(session.context?.pendingConfirmations || {});

    pending[confirmationId] = {
        type,
        params,
        label,
        createdAt: Date.now(),
        expiresAt: Date.now() + CONFIRMATION_TTL_MS,
    };

    session.context = {
        ...(session.context || {}),
        pendingConfirmations: pending,
    };

    return {
        type: "confirm",
        confirmationId,
        actionType: type,
        sensitive: isSensitiveAction(type),
        label: message || label,
        confirmLabel,
        cancelLabel,
    };
};

const getPendingConfirmation = (session, confirmationId) => {
    const pending = session.context?.pendingConfirmations?.[confirmationId];
    if (!pending) return null;
    if (pending.expiresAt && pending.expiresAt < Date.now()) return null;
    return pending;
};

const clearPendingConfirmation = (session, confirmationId) => {
    const pending = { ...(session.context?.pendingConfirmations || {}) };
    delete pending[confirmationId];
    session.context = {
        ...(session.context || {}),
        pendingConfirmations: pruneExpiredConfirmations(pending),
    };
};

const executeConfirmedAction = async (req, pending) => {
    const userId = req.user?._id || null;
    const deviceId = req.deviceId || "";
    const isLogin = Boolean(req.isLogin && userId);

    switch (pending.type) {
        case "add_to_cart": {
            const result = await addProductToBuyerCart({
                productId: pending.params.productId,
                quantity: pending.params.quantity,
                userId,
                deviceId,
                isLogin,
            });
            const name = result.product?.name || "Product";
            return {
                answer: `Done — I added <strong>${result.quantity}× ${name}</strong> to your cart.`,
                status: "ok",
                products: result.card ? [result.card] : [],
                actions: [
                    { type: "navigate", route: "CART", label: "View cart" },
                    {
                        type: "chat",
                        label: "Help me checkout",
                        message: "Help me checkout",
                    },
                ],
                toolResults: [{ tool: "add_to_cart", status: "success", productId: pending.params.productId }],
            };
        }
        case "navigate_checkout":
            return {
                answer: "Taking you to checkout — review your items and shipping details on the next page.",
                status: "ok",
                actions: [
                    { type: "navigate", route: "CHECKOUT", label: "Go to checkout", closeAssistant: true },
                ],
                toolResults: [{ tool: "navigate_checkout", status: "success" }],
            };
        default:
            throw new Error("UNSUPPORTED_CONFIRMATION");
    }
};

module.exports = {
    createPendingConfirmation,
    getPendingConfirmation,
    clearPendingConfirmation,
    executeConfirmedAction,
    isSensitiveAction,
    CONFIRMATION_TTL_MS,
};
