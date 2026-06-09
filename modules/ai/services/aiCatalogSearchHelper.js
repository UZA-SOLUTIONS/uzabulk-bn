const esProductService = require("../../products/services/esProductService");
const { expandSearchQuery } = require("./aiTextSearchService");
const { searchCatalogByEmbeddingPhrase } = require("./aiImageSearchService");

const unwrapEsSearchResult = (result) => {
    if (Array.isArray(result)) return { items: result, total: 0 };
    return {
        items: result?.items || [],
        total: typeof result?.total === "number" ? result.total : 0,
    };
};

/**
 * Run text catalog search with optional AI query expansion + embedding fallback.
 */
const searchCatalogByText = async ({
    search = "",
    limit = 32,
    skip = 1,
    category,
    fieldName,
    fieldValue,
    singleCategoryOnly = false,
} = {}) => {
    const raw = String(search || "").trim();
    if (!raw) {
        return { items: [], total: 0, searchMeta: { engine: "none" } };
    }

    let terms;
    try {
        terms = await expandSearchQuery(raw);
    } catch (error) {
        console.warn("AI text search expansion failed:", error?.message || error);
        terms = { primary: raw, keywords: [raw], original: raw, aiExpanded: false };
    }
    const baseQuery = {
        category,
        fieldName,
        fieldValue,
        limit,
        skip,
        singleCategoryOnly,
        orderBy: "relevance",
        order: -1,
    };

    let merged = [];
    const seen = new Set();

    const ingest = (list = []) => {
        list.forEach((item) => {
            const key = String(item?._id || item?.offerId || "");
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        });
    };

    const primaryPayload = unwrapEsSearchResult(
        await esProductService.list({ ...baseQuery, search: terms.primary || raw })
    );
    ingest(primaryPayload.items);

    if (merged.length < limit) {
        for (const term of (terms.keywords || []).slice(0, 5)) {
            if (merged.length >= limit) break;
            if (term === terms.primary) continue;
            const extra = unwrapEsSearchResult(
                await esProductService.list({ ...baseQuery, search: term, skip: 1 })
            );
            ingest(extra.items);
        }
    }

    if (merged.length < Math.min(limit, 6) && terms.primary) {
        try {
            const embedded = await searchCatalogByEmbeddingPhrase(terms.primary, { limit });
            ingest(embedded);
        } catch (embedError) {
            console.warn("AI embedding text search fallback failed:", embedError?.message || embedError);
        }
    }

    const items = merged.slice(0, limit);
    return {
        items,
        total: Math.max(primaryPayload.total, items.length),
        searchMeta: {
            engine: "elasticsearch",
            aiExpanded: Boolean(terms.aiExpanded),
            primary: terms.primary,
            keywords: terms.keywords,
        },
    };
};

module.exports = { searchCatalogByText };
