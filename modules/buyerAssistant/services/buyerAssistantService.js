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
const {
    withTimeout,
    embeddingsEnabled,
    embedTimeoutMs,
} = require("./buyerAssistantUtils");

const isEnabled = () =>
    String(process.env.BUYER_ASSISTANT_ENABLED ?? "true").toLowerCase() !== "false";

const welcomeMessages = {
    en: "I'm your UZA Bulk buyer assistant. Ask about any product by name (price, MOQ, details), delivery, or your orders. When you're signed in I can use your profile, cart, and order history.",
    fr: "Je suis l'assistant acheteur UZA Bulk. Demandez des détails sur un produit (prix, MOQ), la livraison ou vos commandes. Une fois connecté, j'utilise votre profil, panier et historique.",
    rw: "Ndi umufasha w'umuguzi wa UZA Bulk. Baza ku bicuruzwa (ibiciro, MOQ), itangwa ry'ibicuruzwa cyangwa amategeko yawe. Niba winjiye, nkoresha umwirondoro wawe, agakari n'amateka y'amategeko.",
};

const guestWelcomeMessages = {
    en: "Hi! I'm your UZA Bulk buyer assistant. Ask about products, pricing, delivery, or track an order — include your order ID (e.g. UZA…). Sign in to let me see your orders and cart.",
    fr: "Bonjour ! Je suis l'assistant acheteur UZA Bulk. Posez vos questions sur les produits, les prix, la livraison ou suivez une commande. Connectez-vous pour accéder à vos commandes et votre panier.",
    rw: "Muraho! Ndi umufasha w'umuguzi wa UZA Bulk. Baza ku bicuruzwa, ibiciro cyangwa itangwa. Injira kugira ngo mbone amategeko n'agakari kawe.",
};

const escalationNote = {
    en: "I've flagged this for our support team. A human agent will review your case shortly. You can also reach us via Contact Us or WhatsApp.",
    fr: "J'ai signalé votre demande à notre équipe support. Un agent vous contactera sous peu. Vous pouvez aussi nous joindre via Contactez-nous ou WhatsApp.",
    rw: "Natumenyesheje ikipe yacu y'ubufasha. Umukozi azasubiza vuba. Urashobora kandi kutwandikira binyuze kuri Contact Us cyangwa WhatsApp.",
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

const handleBuyerChat = async (req, body = {}) => {
    if (!isEnabled()) {
        throw new Error("BUYER_ASSISTANT_DISABLED");
    }

    const message = String(body.message || "").trim();
    if (!message) throw new Error("MESSAGE_REQUIRED");

    const userId = req.user?._id || null;
    const deviceId = req.deviceId || "";
    const language = detectLanguage(message);

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

    let generation = {
        answer: "",
        status: "EXCEPTION",
        sources: [],
        model: null,
        contextCount: retrieval.chunks.length,
    };

    if (isDashscopeConfigured()) {
        generation = await generateBuyerResponse({
            userMessage: message,
            language,
            chunks: retrieval.chunks,
            conversationHistory: history,
            isLoggedIn: Boolean(userId),
        });
    } else {
        generation.answer = retrieval.chunks.length
            ? `${retrieval.chunks[0].title}: ${retrieval.chunks[0].text}`.slice(0, 600)
            : "AI assistant is not configured. Please contact support.";
    }

    const risk = assessDisputeRisk(message, generation.status);
    const dispute_flag = risk.dispute_flag || risk.escalate;
    let answer = generation.answer;

    if (dispute_flag && risk.escalate) {
        answer = `${answer}\n\n${escalationNote[language] || escalationNote.en}`;
    }

    const products = extractProductCards(retrieval.chunks);
    const actions = buildAssistantActions({
        message,
        retrieval,
        products,
        isLoggedIn: Boolean(userId),
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
    };

    session.messages.push(
        { role: "user", content: message, language, date_created_utc: new Date() },
        {
            role: "assistant",
            content: answer,
            language,
            dispute_flag,
            status: generation.status,
            metadata: assistantMeta,
            products,
            actions,
            date_created_utc: new Date(),
        }
    );
    session.language = language;
    session.dispute_flag = session.dispute_flag || dispute_flag;
    session.escalated = session.escalated || risk.escalate;
    session.context = {
        ...session.context,
        lastOrderRef: retrieval.orderRef,
        lastProductId: body.productId || session.context?.lastProductId,
    };
    session.date_modified_utc = new Date();

    const payload = {
        sessionId: session._id,
        answer,
        language,
        status: generation.status,
        dispute_flag,
        escalated: risk.escalate,
        sources: assistantMeta.chunks,
        products,
        actions,
        welcome: welcomeMessages[language] || welcomeMessages.en,
    };

    session.save().catch((err) => {
        console.warn("buyerAssistant session save:", err?.message || err);
    });

    return payload;
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
        messages: (session.messages || []).map((m) => ({
            role: m.role,
            content: m.content,
            language: m.language,
            dispute_flag: m.dispute_flag,
            status: m.status,
        })),
        dispute_flag: session.dispute_flag,
        escalated: session.escalated,
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
    session.context = {
        ...session.context,
        escalation: {
            id: uuidv4(),
            note: String(body.note || body.message || "").slice(0, 2000),
            at: new Date(),
            userId: userId ? String(userId) : null,
            deviceId,
        },
    };
    session.date_modified_utc = new Date();
    await session.save();

    return {
        sessionId: session._id,
        escalated: true,
        message: escalationNote[session.language] || escalationNote.en,
    };
};

module.exports = {
    handleBuyerChat,
    getWelcome,
    getSessionHistory,
    escalateToAgent,
    isEnabled,
    welcomeMessages,
};
