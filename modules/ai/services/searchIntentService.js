const ProductBehavior = require("../../../models/productBehaviorTable");
const { normalizeTerm } = require("./aiTextSearchService");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getIdentityQuery = (req) => {
    const or = [];
    if (req?.user?._id) or.push({ user: req.user._id });
    const deviceId = String(req?.deviceId ?? req?.headers?.deviceid ?? "").trim();
    if (deviceId) or.push({ deviceId });
    return or.length ? { $or: or } : null;
};

/**
 * Learn from popular + personal search history to refine query understanding.
 */
const getSearchIntentContext = async (search = "", req = null) => {
    const query = normalizeTerm(search);
    const context = {
        popularSearches: [],
        recentSearches: [],
        recentInterpretations: [],
    };
    if (!query) return context;

    try {
        if (global._model?.FrequentlySearch) {
            const prefix = escapeRegex(query.slice(0, Math.min(query.length, 5)));
            const popular = await global._model.FrequentlySearch.find({
                search: { $regex: new RegExp(`^${prefix}`, "i") },
            })
                .sort({ count: -1, updated_at: -1 })
                .limit(6)
                .lean();
            context.popularSearches = popular
                .map((row) => normalizeTerm(row?.search))
                .filter((term) => term && term !== query);
        }
    } catch (error) {
        console.warn("Popular search context failed:", error?.message || error);
    }

    try {
        const identity = getIdentityQuery(req);
        if (identity && ProductBehavior) {
            const recent = await ProductBehavior.find({
                ...identity,
                eventType: "search",
                search: { $exists: true, $ne: "" },
            })
                .sort({ created_at: -1 })
                .limit(10)
                .lean();

            context.recentSearches = recent
                .map((row) => normalizeTerm(row?.search))
                .filter(Boolean);

            context.recentInterpretations = recent
                .map((row) => normalizeTerm(row?.metadata?.interpretedQuery || row?.metadata?.primary))
                .filter(Boolean);
        }
    } catch (error) {
        console.warn("Personal search context failed:", error?.message || error);
    }

    return context;
};

const recordSearchIntent = async (raw = "", terms = {}, req = null) => {
    const search = normalizeTerm(raw);
    if (!search) return;

    try {
        if (global._model?.FrequentlySearch?.set) {
            void global._model.FrequentlySearch.set(search);
        }
    } catch (error) {
        console.warn("FrequentlySearch tracking failed:", error?.message || error);
    }

    try {
        const { trackProductBehavior } = require("../../products/services/recommendationService");
        if (!req) return;
        void trackProductBehavior(req, {
            eventType: "search",
            search,
            score: 1,
            metadata: {
                interpretedQuery: terms.primary || terms.correctedQuery || search,
                primary: terms.primary || "",
                productType: terms.productType || "",
                categoryHint: terms.categoryHint || "",
                keywords: Array.isArray(terms.keywords) ? terms.keywords.slice(0, 6) : [],
            },
        });
    } catch (error) {
        console.warn("Search intent tracking failed:", error?.message || error);
    }
};

module.exports = {
    getSearchIntentContext,
    recordSearchIntent,
};
