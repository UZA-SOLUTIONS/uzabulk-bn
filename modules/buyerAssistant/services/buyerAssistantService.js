const { v4: uuidv4 } = require("uuid");
const { isDashscopeConfigured } = require("../../ai/dashscopeClient");
const { getEmbedding } = require("../../ai/services/embeddingService");
const BuyerAssistantSession = require("../../../models/buyerAssistantSessionTable");
const { detectLanguage } = require("./languageDetectionService");
const { retrieveKnowledge } = require("./knowledgeRetrievalService");
const { generateBuyerResponse } = require("./responseGenerationService");
const { assessDisputeRisk } = require("./disputeDetectionService");
const { displayName } = require("./buyerContextService");
const {
    extractProductCards,
    buildAssistantActions,
} = require("./assistantEnrichmentService");
const { extractSearchQuery, isAccountIntentQuery, isCartIntentQuery } = require("./assistantIntentService");
const {
    buildGroundedProductAnswer,
    filterAssistantProductCards,
} = require("./assistantProductSearchHelper");
const { buildGroundedCartAnswer } = require("./assistantCartService");
const {
    resolveAssistantMode,
    buildGroundedOrderEmptyAnswer,
    buildGroundedCheckoutEmptyAnswer,
    buildCartEmptyWithSearchAnswer,
    buildOrderEmptyWithSearchAnswer,
    buildCheckoutEmptyWithSearchAnswer,
} = require("./assistantContextResolver");
const { runAssistantTools } = require("./assistantToolsService");
const {
    getPendingConfirmation,
    clearPendingConfirmation,
    executeConfirmedAction,
} = require("./assistantConfirmationService");
const {
    withTimeout,
    embeddingsEnabled,
    embedTimeoutMs,
} = require("./buyerAssistantUtils");

/** When true, cart/product/empty intents use HTML templates instead of RAG+LLM. Default: false. */
const useGroundedTemplates = () =>
    String(process.env.BUYER_ASSISTANT_USE_GROUNDED_TEMPLATES ?? "false").toLowerCase() === "true";

const isEnabled = () =>
    String(process.env.BUYER_ASSISTANT_ENABLED ?? "true").toLowerCase() !== "false";

const SUPPORT_WHATSAPP_DISPLAY = process.env.SUPPORT_WHATSAPP_DISPLAY || "0788 371 081";

const welcomeMessages = {
    en: `I'm your UZA Bulk buyer assistant. Ask about any product by name (price, MOQ, details), delivery, or your orders. When you're signed in I can use your profile, cart, and order history — and help you add items to cart or reach checkout. Need a human? Chat with customer support on WhatsApp: ${SUPPORT_WHATSAPP_DISPLAY}.`,
    fr: `Je suis l'assistant acheteur UZA Bulk. Demandez des détails sur un produit (prix, MOQ), la livraison ou vos commandes. Une fois connecté, j'utilise votre profil, panier et historique — et je peux vous aider à ajouter au panier ou passer commande. Besoin d'un humain ? WhatsApp : ${SUPPORT_WHATSAPP_DISPLAY}.`,
    rw: `Ndi umufasha w'umuguzi wa UZA Bulk. Baza ku bicuruzwa (ibiciro, MOQ), itangwa cyangwa amategeko yawe. Niba winjiye, nkoresha umwirondoro wawe, agakari n'amateka — kandi nshobora kugufasha kongeramo ibicuruzwa cyangwa kugera ku checkout. Ukeneye umuntu? Vugana n'ubufasha kuri WhatsApp: ${SUPPORT_WHATSAPP_DISPLAY}.`,
};

const guestWelcomeMessages = {
    en: `Hi! I'm your UZA Bulk buyer assistant. Ask about products, pricing, delivery, or track an order — include your order ID (e.g. UZA…). Sign in to let me see your orders, cart, and help you checkout. For a human agent, WhatsApp us at ${SUPPORT_WHATSAPP_DISPLAY}.`,
    fr: `Bonjour ! Je suis l'assistant acheteur UZA Bulk. Posez vos questions sur les produits, les prix, la livraison ou suivez une commande. Connectez-vous pour accéder à vos commandes, panier et checkout. Pour un agent humain, WhatsApp : ${SUPPORT_WHATSAPP_DISPLAY}.`,
    rw: `Muraho! Ndi umufasha w'umuguzi wa UZA Bulk. Baza ku bicuruzwa, ibiciro cyangwa itangwa. Injira kugira ngo mbone amategeko, agakari kawe, kandi ngufashe checkout. Ukeneye umukozi? WhatsApp: ${SUPPORT_WHATSAPP_DISPLAY}.`,
};

const escalationNote = {
    en: `I've flagged this for our support team. A human agent will review your case shortly. You can also chat with us directly on WhatsApp: ${SUPPORT_WHATSAPP_DISPLAY}.`,
    fr: `J'ai signalé votre demande à notre équipe support. Un agent vous contactera sous peu. Vous pouvez aussi discuter directement sur WhatsApp : ${SUPPORT_WHATSAPP_DISPLAY}.`,
    rw: `Natumenyesheje ikipe yacu y'ubufasha. Umukozi azasubiza vuba. Urashobora kandi kuvugana natwe kuri WhatsApp: ${SUPPORT_WHATSAPP_DISPLAY}.`,
};

const cancelConfirmationNote = {
    en: "Okay — I cancelled that. Let me know if you'd like something else.",
    fr: "D'accord — j'ai annulé. Dites-moi si vous souhaitez autre chose.",
    rw: "Sawa — byahagaritswe. Mbwire niba ukeneye ikindi.",
};

const notifyEscalation = (session, userId, deviceId, note = "") => {
    const payload = {
        sessionId: String(session._id),
        userId: userId ? String(userId) : null,
        deviceId,
        note: String(note || "").slice(0, 500),
        at: new Date().toISOString(),
    };
    console.warn("[buyer-assistant] ESCALATION", JSON.stringify(payload));
};

const resolveSession = async ({ sessionId, userId, deviceId }) => {
    if (sessionId) {
        const existing = await BuyerAssistantSession.findById(sessionId);
        if (existing) {
            const userOk = !userId
                || !existing.user
                || String(existing.user) === String(userId);
            const deviceOk = !deviceId
                || !existing.deviceId
                || existing.deviceId === deviceId;

            if (userOk && (deviceOk || userId)) {
                let dirty = false;
                if (userId && !existing.user) {
                    existing.user = userId;
                    dirty = true;
                }
                if (deviceId && !existing.deviceId) {
                    existing.deviceId = deviceId;
                    dirty = true;
                }
                if (dirty) await existing.save();
                return existing;
            }
        }
    }

    return BuyerAssistantSession.create({
        user: userId || null,
        deviceId: deviceId || "",
        messages: [],
        context: {},
    });
};

const mergeProductCards = (primary = [], extra = []) => {
    const seen = new Set();
    const merged = [];
    [...primary, ...extra].forEach((card) => {
        if (!card?.id || seen.has(card.id)) return;
        seen.add(card.id);
        merged.push(card);
    });
    return merged.slice(0, 4);
};

const appendAssistantTurn = (session, {
    userMessage,
    answer,
    language,
    dispute_flag,
    generation,
    assistantMeta,
    products,
    actions,
}) => {
    session.messages.push(
        { role: "user", content: userMessage, language, date_created_utc: new Date() },
        {
            role: "assistant",
            content: answer,
            language,
            dispute_flag,
            status: generation.status,
            metadata: assistantMeta,
            date_created_utc: new Date(),
        }
    );
    session.language = language;
    session.date_modified_utc = new Date();
};

const buildChatPayload = ({
    session,
    answer,
    language,
    generation,
    dispute_flag,
    escalated,
    assistantMeta,
    products,
    actions,
    workflow,
}) => ({
    sessionId: session._id,
    answer,
    language,
    status: generation.status,
    dispute_flag,
    escalated,
    sources: assistantMeta.chunks,
    products,
    actions,
    workflow: workflow || session.context?.workflow || null,
    welcome: welcomeMessages[language] || welcomeMessages.en,
});

const handleBuyerChat = async (req, body = {}) => {
    if (!isEnabled()) {
        throw new Error("BUYER_ASSISTANT_DISABLED");
    }

    const message = String(body.message || "").trim();
    if (!message) throw new Error("MESSAGE_REQUIRED");

    const userId = req.user?._id || null;
    const deviceId = req.deviceId || "";
    const language = detectLanguage(message, body.preferredLanguage || body.lang);

    const [session, queryVector] = await Promise.all([
        resolveSession({
            sessionId: body.sessionId,
            userId,
            deviceId,
        }),
        embeddingsEnabled() && isDashscopeConfigured()
            ? withTimeout(
                getEmbedding(message).catch((embedError) => {
                    console.warn("buyerAssistant embedding:", embedError.message);
                    return null;
                }),
                embedTimeoutMs(),
                null
            )
            : Promise.resolve(null),
    ]);

    const history = session.messages || [];

    const retrieval = await retrieveKnowledge({
        query: message,
        queryVector,
        userId,
        deviceId,
        productId: body.productId,
        orderRef: body.orderId || body.orderRef,
    });

    const tools = await runAssistantTools({
        message,
        userId,
        deviceId,
        productId: body.productId,
        retrieval,
        session,
        language,
        isLoggedIn: Boolean(userId),
    });

    if (tools.workflowUpdate !== undefined) {
        session.context = {
            ...(session.context || {}),
            workflow: tools.workflowUpdate,
        };
    }

    const mode = tools.mode || resolveAssistantMode({
        message,
        intent: tools.intent || {},
        cartSnapshot: tools.cartSnapshot,
        retrieval,
        userId,
        isLoggedIn: Boolean(userId),
    });

    const productFinding = mode.mode === "product_search"
        || (Boolean(
            (retrieval.productFinding || tools.intent?.isProductFinding)
            && !tools.intent?.isAccountIntent
            && !isAccountIntentQuery(message)
        ) && mode.mode === "general");

    const searchQuery = mode.searchQuery || extractSearchQuery(message);
    let products = mergeProductCards(
        extractProductCards(retrieval.chunks),
        tools.extraProducts
    );

    if (mode.allowProductCards && searchQuery) {
        products = filterAssistantProductCards(products, searchQuery, { limit: 4 });
    } else if (mode.mode === "cart" && Number(tools.cartSnapshot?.itemCount || 0) > 0) {
        products = [];
    } else if (["order", "cart"].includes(mode.mode) && !mode.allowProductCards) {
        products = [];
    } else if (isAccountIntentQuery(message) && !mode.allowProductCards) {
        products = [];
    } else if (productFinding && searchQuery) {
        products = filterAssistantProductCards(products, searchQuery, { limit: 4 });
    }

    const guidanceHint = tools.confirmations?.length ? "" : tools.answerHint;

    let generation = {
        answer: "",
        status: "EXCEPTION",
        sources: [],
        model: null,
        contextCount: retrieval.chunks.length,
    };

    const buildTemplateFallback = () => {
        if (tools.confirmations?.length) return null;
        switch (mode.mode) {
            case "cart":
            case "cart_empty":
                return {
                    answer: buildGroundedCartAnswer(tools.cartSnapshot, language, Boolean(userId)),
                    status: "ok",
                    sources: ["customer_cart"],
                    model: `grounded-${mode.mode}`,
                    contextCount: retrieval.chunks.length,
                };
            case "cart_empty_search":
                return {
                    answer: buildCartEmptyWithSearchAnswer({
                        cartSnapshot: tools.cartSnapshot,
                        products,
                        searchQuery: mode.searchQuery,
                        language,
                        isLoggedIn: Boolean(userId),
                    }),
                    status: products.length ? "ok" : "EXCEPTION",
                    sources: products.map((p) => p.name),
                    model: "grounded-empty-search",
                    contextCount: retrieval.chunks.length,
                };
            case "checkout_empty_search":
                return {
                    answer: buildCheckoutEmptyWithSearchAnswer({
                        products,
                        searchQuery: mode.searchQuery,
                        language,
                    }),
                    status: products.length ? "ok" : "EXCEPTION",
                    sources: products.map((p) => p.name),
                    model: "grounded-checkout-empty-search",
                    contextCount: retrieval.chunks.length,
                };
            case "order_empty_search":
                return {
                    answer: buildOrderEmptyWithSearchAnswer({
                        products,
                        searchQuery: mode.searchQuery,
                        language,
                        isLoggedIn: Boolean(userId),
                    }),
                    status: products.length ? "ok" : "EXCEPTION",
                    sources: products.map((p) => p.name),
                    model: "grounded-order-empty-search",
                    contextCount: retrieval.chunks.length,
                };
            case "checkout_empty":
                return {
                    answer: buildGroundedCheckoutEmptyAnswer(language, { hasSearch: false }),
                    status: "ok",
                    sources: ["customer_cart"],
                    model: "grounded-checkout-empty",
                    contextCount: retrieval.chunks.length,
                };
            case "order_empty":
                return {
                    answer: buildGroundedOrderEmptyAnswer(language, Boolean(userId)),
                    status: "ok",
                    sources: ["order_history"],
                    model: "grounded-order-empty",
                    contextCount: retrieval.chunks.length,
                };
            case "product_search":
                return {
                    answer: buildGroundedProductAnswer(products, searchQuery, language),
                    status: products.length ? "ok" : "EXCEPTION",
                    sources: products.map((p) => p.name),
                    model: "grounded-catalog",
                    contextCount: retrieval.chunks.length,
                };
            default:
                if (productFinding) {
                    return {
                        answer: buildGroundedProductAnswer(products, searchQuery, language),
                        status: products.length ? "ok" : "EXCEPTION",
                        sources: products.map((p) => p.name),
                        model: "grounded-catalog",
                        contextCount: retrieval.chunks.length,
                    };
                }
                return null;
        }
    };

    // Prefer RAG + LLM for every intent (cart, find product, checkout, orders, etc.).
    // Templates remain as optional opt-in or emergency fallback when the LLM is unavailable.
    if (useGroundedTemplates() && !tools.confirmations?.length) {
        const template = buildTemplateFallback();
        if (template?.answer) generation = template;
    }

    if (!generation.answer && isDashscopeConfigured()) {
        try {
            generation = await generateBuyerResponse({
                userMessage: message,
                language,
                chunks: retrieval.chunks,
                conversationHistory: history,
                isLoggedIn: Boolean(userId),
                toolContext: tools.toolContext,
                answerHint: guidanceHint,
                isProductFinding: productFinding,
                assistantMode: mode.mode,
                catalogProducts: products,
            });
        } catch (genError) {
            console.warn("buyerAssistant RAG generation:", genError?.message || genError);
            generation = { answer: "", status: "EXCEPTION", sources: [], model: null, contextCount: retrieval.chunks.length };
        }
    }

    if (!generation.answer) {
        const template = buildTemplateFallback();
        if (template?.answer) {
            generation = template;
        } else if (retrieval.chunks.length) {
            generation.answer = `${retrieval.chunks[0].title}: ${retrieval.chunks[0].text}`.slice(0, 600);
            generation.status = "ok";
            generation.model = "chunk-fallback";
        } else {
            generation.answer = "AI assistant is not configured. Please contact support.";
        }
    }

    const risk = assessDisputeRisk(message, generation.status);
    const dispute_flag = risk.dispute_flag || risk.escalate;
    let answer = generation.answer;

    if (tools.answerHint && tools.confirmations?.length) {
        answer = `${answer}\n\n${tools.answerHint}`;
    }

    if (dispute_flag && risk.escalate) {
        answer = `${answer}\n\n${escalationNote[language] || escalationNote.en}`;
    }

    const actions = buildAssistantActions({
        message,
        retrieval,
        products,
        isLoggedIn: Boolean(userId),
        cartSnapshot: tools.cartSnapshot,
        toolActions: [...(tools.confirmations || []), ...(tools.actions || [])],
    });

    const assistantMeta = {
        sources: generation.sources,
        chunks: retrieval.chunks.map((c) => ({ source: c.source, title: c.title })),
        orderRef: retrieval.orderRef,
        orderFound: retrieval.orderFound,
        orderId: retrieval.orderId || null,
        model: generation.model,
        riskScore: risk.score,
        riskReasons: risk.reasons,
        products,
        actions,
        toolResults: tools.toolResults,
        intent: tools.intent?.primary || "general",
        assistantMode: mode.mode,
        productFinding,
        workflow: session.context?.workflow || null,
    };

    appendAssistantTurn(session, {
        userMessage: message,
        answer,
        language,
        dispute_flag,
        generation,
        assistantMeta,
        products,
        actions,
    });

    session.dispute_flag = session.dispute_flag || dispute_flag;
    session.escalated = session.escalated || risk.escalate;
    session.context = {
        ...session.context,
        lastOrderRef: retrieval.orderRef,
        lastProductId: body.productId || session.context?.lastProductId,
    };

    const payload = buildChatPayload({
        session,
        answer,
        language,
        generation,
        dispute_flag,
        escalated: risk.escalate,
        assistantMeta,
        products,
        actions,
        workflow: session.context?.workflow,
    });

    session.save().catch((err) => {
        console.warn("buyerAssistant session save:", err?.message || err);
    });

    return payload;
};

const handleConfirmAction = async (req, body = {}) => {
    if (!isEnabled()) throw new Error("BUYER_ASSISTANT_DISABLED");

    const confirmationId = String(body.confirmationId || "").trim();
    if (!confirmationId) throw new Error("CONFIRMATION_ID_REQUIRED");

    const userId = req.user?._id || null;
    const deviceId = req.deviceId || "";
    const confirmed = body.confirmed !== false;

    const session = await resolveSession({
        sessionId: body.sessionId,
        userId,
        deviceId,
    });

    const pending = getPendingConfirmation(session, confirmationId);
    if (!pending) throw new Error("CONFIRMATION_NOT_FOUND");

    clearPendingConfirmation(session, confirmationId);

    const language = session.language || "en";
    let result;

    if (!confirmed) {
        result = {
            answer: cancelConfirmationNote[language] || cancelConfirmationNote.en,
            status: "ok",
            products: [],
            actions: [],
            toolResults: [{ tool: pending.type, status: "cancelled" }],
        };
    } else {
        result = await executeConfirmedAction(req, pending);
    }

    const assistantMeta = {
        confirmationId,
        confirmed,
        actionType: pending.type,
        products: result.products || [],
        actions: result.actions || [],
        toolResults: result.toolResults || [],
    };

    appendAssistantTurn(session, {
        userMessage: confirmed ? `[Confirmed: ${pending.type}]` : `[Cancelled: ${pending.type}]`,
        answer: result.answer,
        language,
        dispute_flag: false,
        generation: { status: result.status || "ok" },
        assistantMeta,
        products: result.products || [],
        actions: result.actions || [],
    });

    session.save().catch((err) => {
        console.warn("buyerAssistant confirm save:", err?.message || err);
    });

    return buildChatPayload({
        session,
        answer: result.answer,
        language,
        generation: { status: result.status || "ok" },
        dispute_flag: session.dispute_flag,
        escalated: session.escalated,
        assistantMeta,
        products: result.products || [],
        actions: result.actions || [],
        workflow: session.context?.workflow,
    });
};

const getWelcome = (language = "en", user = null) => {
    const loggedIn = Boolean(user?._id || user?.id);
    let message = loggedIn
        ? (welcomeMessages[language] || welcomeMessages.en)
        : (guestWelcomeMessages[language] || guestWelcomeMessages.en);

    if (loggedIn) {
        const name = displayName(user);
        const first = name.split(/\s+/)[0];
        if (first && first !== "Customer") {
            const prefixes = {
                en: `Hi ${first}! `,
                fr: `Bonjour ${first} ! `,
                rw: `Muraho ${first}! `,
            };
            message = (prefixes[language] || prefixes.en) + message;
        }
    }

    return {
        message,
        language,
        sessionId: null,
        isLoggedIn: loggedIn,
    };
};

const getSessionHistory = async ({ sessionId, userId, deviceId }) => {
    const session = await BuyerAssistantSession.findById(sessionId).lean();
    if (!session) return null;

    const userOk = userId
        ? (!session.user || String(session.user) === String(userId))
        : true;
    const deviceOk = deviceId
        ? (!session.deviceId || session.deviceId === deviceId)
        : true;
    if (!userOk || (!userId && !deviceOk)) return null;

    return {
        sessionId: session._id,
        messages: (session.messages || []).map((m, index) => ({
            id: `${m.role}-${index}`,
            role: m.role,
            content: String(m.content || "").startsWith("[Confirmed:")
                || String(m.content || "").startsWith("[Cancelled:")
                ? ""
                : m.content,
            language: m.language,
            dispute_flag: m.dispute_flag,
            status: m.status,
            products: m.metadata?.products || [],
            actions: m.metadata?.actions || [],
        })).filter((m) => m.content || m.products?.length || m.actions?.length),
        dispute_flag: session.dispute_flag,
        escalated: session.escalated,
        workflow: session.context?.workflow || null,
    };
};

const escalateToAgent = async (req, body = {}) => {
    const userId = req.user?._id || null;
    const deviceId = req.deviceId || "";
    const session = await resolveSession({
        sessionId: body.sessionId,
        userId,
        deviceId,
    });

    session.escalated = true;
    session.dispute_flag = true;
    const note = String(body.note || body.message || "").slice(0, 2000);
    session.context = {
        ...session.context,
        escalation: {
            id: uuidv4(),
            note,
            at: new Date(),
            userId: userId ? String(userId) : null,
            deviceId,
        },
    };
    session.date_modified_utc = new Date();
    await session.save();

    notifyEscalation(session, userId, deviceId, note);

    return {
        sessionId: session._id,
        escalated: true,
        message: escalationNote[session.language] || escalationNote.en,
    };
};

module.exports = {
    handleBuyerChat,
    handleConfirmAction,
    getWelcome,
    getSessionHistory,
    escalateToAgent,
    isEnabled,
    welcomeMessages,
};
