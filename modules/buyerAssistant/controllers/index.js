const {
    handleBuyerChat,
    handleConfirmAction,
    getWelcome,
    getSessionHistory,
    escalateToAgent,
    isEnabled,
} = require("../services/buyerAssistantService");

module.exports = {
    status: (req, res) => {
        return res.success("BUYER_ASSISTANT_STATUS", {
            enabled: isEnabled(),
            rag: true,
            agentic: true,
            confirmations: true,
            capabilities: [
                "product_search",
                "cart_read",
                "add_to_cart",
                "checkout_guidance",
                "order_tracking",
                "navigation",
            ],
            languages: ["en", "fr", "rw"],
        });
    },

    welcome: (req, res) => {
        try {
            const language = String(req.query.lang || "en").slice(0, 2);
            const user = req.isLogin ? req.user : null;
            return res.success("WELCOME", getWelcome(language, user));
        } catch (error) {
            console.error("buyerAssistant.welcome", error);
            return res.error(error);
        }
    },

    chat: async (req, res) => {
        try {
            const result = await handleBuyerChat(req, req.body || {});
            return res.success("ASSISTANT_REPLY", result);
        } catch (error) {
            console.error("buyerAssistant.chat", error);
            return res.error(error);
        }
    },

    confirm: async (req, res) => {
        try {
            const result = await handleConfirmAction(req, req.body || {});
            return res.success("ASSISTANT_CONFIRMED", result);
        } catch (error) {
            console.error("buyerAssistant.confirm", error);
            return res.error(error);
        }
    },

    history: async (req, res) => {
        try {
            const sessionId = req.query.sessionId;
            if (!sessionId) return res.error("SESSION_ID_REQUIRED");

            const history = await getSessionHistory({
                sessionId,
                userId: req.user?._id,
                deviceId: req.deviceId,
            });

            if (!history) return res.error("SESSION_NOT_FOUND");
            return res.success("SESSION_HISTORY", history);
        } catch (error) {
            console.error("buyerAssistant.history", error);
            return res.error(error);
        }
    },

    escalate: async (req, res) => {
        try {
            const result = await escalateToAgent(req, req.body || {});
            return res.success("ESCALATED_TO_AGENT", result);
        } catch (error) {
            console.error("buyerAssistant.escalate", error);
            return res.error(error);
        }
    },
};
