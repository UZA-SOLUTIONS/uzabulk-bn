const { parseJsonFromLlm } = require("../../ai/helpers/parseJsonFromLlm");
const { chatCompletionWithFallback } = require("../../ai/services/chatWithFallback");
const { isDashscopeConfigured } = require("../../ai/dashscopeClient");
const { cosineSimilarity } = require("../../ai/services/embeddingService");
const { diversifyByCategory } = require("./feedMixService");

const RANKING_MODEL = () =>
    process.env.DASHSCOPE_RANKING_MODEL
    || env?.dashscope?.MODEL
    || "qwen-turbo";

const BUSINESS_RULES = {
    minSupplierRating: Number(process.env.VECTOR_SEARCH_MIN_SUPPLIER_RATING || 3.5),
    inStockBoost: 1.15,
    bestsellerBoost: 1.08,
    repurchaseBoost: 1.2,
    priceSensitivePenaltyAboveMedian: 0.85,
};

const scoreContentBased = (candidate, {
    userEmbedding = null,
    categoryScores = new Map(),
    coScores = new Map(),
    repurchaseIds = new Set(),
    priceSensitivity = "medium",
    medianViewPrice = null,
}) => {
    let score = 0;

    if (userEmbedding && Array.isArray(candidate.embedding) && candidate.embedding.length) {
        score += cosineSimilarity(userEmbedding, candidate.embedding) * 8;
    }

    (candidate.categories || []).forEach((catId) => {
        score += (categoryScores.get(String(catId)) || 0) * 0.75;
    });

    score += (coScores.get(String(candidate._id)) || 0) * 2.2;
    score += Math.min(Number(candidate.average_rating) || 0, 5) * 0.5;
    score += Math.log1p(Number(candidate.sold_count) || 0) * 0.2;

    if (candidate.stock_status === "instock" || candidate.manage_stock) {
        score *= BUSINESS_RULES.inStockBoost;
    }
    if (candidate.bestSeller) {
        score *= BUSINESS_RULES.bestsellerBoost;
    }
    if (repurchaseIds.has(String(candidate._id))) {
        score *= BUSINESS_RULES.repurchaseBoost;
    }

    if (
        priceSensitivity === "high"
        && medianViewPrice != null
        && Number(candidate.price) > medianViewPrice * 1.15
    ) {
        score *= BUSINESS_RULES.priceSensitivePenaltyAboveMedian;
    }

    const supplierRating = Number(candidate.supplier_rating);
    if (Number.isFinite(supplierRating) && supplierRating < BUSINESS_RULES.minSupplierRating) {
        score *= 0.7;
    }

    return score;
};

/**
 * Qwen3-Turbo ranking with business rules (treatment group only).
 */
const rankWithQwenTurbo = async (candidates = [], context = {}) => {
    if (!isDashscopeConfigured() || !candidates.length) {
        return candidates;
    }

    const compact = candidates.slice(0, 24).map((row) => ({
        id: String(row._id),
        name: row.name,
        price: row.price,
        categories: row.categories,
        sold_count: row.sold_count,
        supplier_rating: row.supplier_rating,
    }));

    try {
        const { content } = await chatCompletionWithFallback({
            model: RANKING_MODEL(),
            temperature: 0.1,
            messages: [
                {
                    role: "system",
                    content: [
                        "You rank wholesale products for UZA Bulk buyers.",
                        "Apply business rules: prefer in-stock, MOQ-friendly, high supplier rating, regional relevance.",
                        "Return JSON only: { \"ordered_ids\": string[] }",
                    ].join("\n"),
                },
                {
                    role: "user",
                    content: [
                        `Surface: ${context.surface || "homepage_feed"}`,
                        `Country: ${context.country || "unknown"}`,
                        `Price sensitivity: ${context.priceSensitivity || "medium"}`,
                        `Recent searches: ${(context.recentSearches || []).join(", ")}`,
                        `Candidates: ${JSON.stringify(compact)}`,
                    ].join("\n"),
                },
            ],
        });

        const parsed = parseJsonFromLlm(content);
        const orderedIds = Array.isArray(parsed?.ordered_ids) ? parsed.ordered_ids.map(String) : [];
        if (!orderedIds.length) return candidates;

        const byId = new Map(candidates.map((row) => [String(row._id), row]));
        const ranked = [];
        const seen = new Set();
        orderedIds.forEach((id) => {
            const row = byId.get(id);
            if (!row || seen.has(id)) return;
            seen.add(id);
            ranked.push(row);
        });
        candidates.forEach((row) => {
            const id = String(row._id);
            if (!seen.has(id)) ranked.push(row);
        });
        return ranked;
    } catch (error) {
        console.warn("[recommendations] Qwen ranking failed:", error.message);
        return candidates;
    }
};

/**
 * Collaborative filtering + content-based hybrid score, optional Qwen re-rank.
 */
const rankCandidates = async (candidates = [], {
    userEmbedding = null,
    signals = {},
    coScores = new Map(),
    abGroup = "control",
    surface = "homepage_feed",
} = {}) => {
    const categoryScores = new Map(
        (signals.preferredCategories || []).map((id, index) => [String(id), 8 - index])
    );
    const repurchaseIds = new Set(signals.transactions?.repurchaseProductIds || []);

    const prices = candidates
        .map((row) => Number(row.price))
        .filter((price) => Number.isFinite(price) && price > 0);
    const medianViewPrice = prices.length
        ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        : null;

    const scored = candidates
        .map((row) => ({
            row,
            score: scoreContentBased(row, {
                userEmbedding,
                categoryScores,
                coScores,
                repurchaseIds,
                priceSensitivity: signals.priceSensitivity,
                medianViewPrice,
            }),
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.row);

    let ranked = scored;
    if (abGroup === "treatment") {
        ranked = await rankWithQwenTurbo(scored, {
            surface,
            country: signals.country,
            priceSensitivity: signals.priceSensitivity,
            recentSearches: signals.engagement?.recentSearches || [],
        });
    }

    const maxPerCategory = surface === "homepage_feed" ? 2 : 3;
    return diversifyByCategory(ranked, {
        maxPerCategory,
        limit: ranked.length,
    });
};

module.exports = {
    rankCandidates,
    scoreContentBased,
};
