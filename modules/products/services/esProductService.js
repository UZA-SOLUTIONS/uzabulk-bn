const productIndex = require("../../../elasticsearch/indexes/productIndex");
const {
    expandCategoryFilterIds,
    buildEsCategoryFilter,
} = require("./categoryFilterHelper");

const normalizeSearchQuery = (raw = "") =>
    String(raw || "").trim().replace(/\s+/g, " ");

const getSearchClauses = (rawSearch = "") => {
    const q = normalizeSearchQuery(rawSearch);
    if (!q) return [];

    const tokens = q.split(" ").filter(Boolean);
    const isShort = q.length <= 3 || tokens.length === 1;
    const textFields = [
        "name^14",
        "name.prefix^10",
        "short_description^4",
        "description^2",
        "sku^9",
        "offerId^8",
    ];

    const clauses = [
        {
            term: {
                "name.keyword": {
                    value: q.toLowerCase(),
                    boost: 24,
                },
            },
        },
        {
            multi_match: {
                query: q,
                fields: ["name^18", "name.prefix^12"],
                type: "phrase",
                boost: 16,
            },
        },
        {
            multi_match: {
                query: q,
                fields: ["name.prefix^10"],
                type: "bool_prefix",
                boost: 8,
            },
        },
        {
            multi_match: {
                query: q,
                fields: textFields,
                type: "cross_fields",
                operator: "and",
                boost: 9,
            },
        },
        {
            multi_match: {
                query: q,
                fields: textFields,
                minimum_should_match: tokens.length >= 3 ? "75%" : "100%",
                boost: 5,
            },
        },
    ];

    if (!isShort) {
        clauses.push({
            multi_match: {
                query: q,
                fields: ["name^6", "short_description^2"],
                fuzziness: "AUTO",
                prefix_length: 2,
                minimum_should_match: "70%",
                boost: 2.5,
            },
        });
    } else {
        clauses.push({
            match_phrase_prefix: {
                name: {
                    query: q,
                    max_expansions: 25,
                    boost: 4.5,
                },
            },
        });
    }

    return clauses;
};

const buildSearchQuery = (search) => {
    const q = normalizeSearchQuery(search);
    if (!q) return null;
    return {
        bool: {
            should: getSearchClauses(q),
            minimum_should_match: 1,
        },
    };
};

const buildFunctionScore = (searchQuery) => {
    if (!searchQuery) return null;
    return {
        function_score: {
            query: searchQuery,
            score_mode: "sum",
            boost_mode: "sum",
            functions: [
                { field_value_factor: { field: "sold_count", modifier: "log1p", factor: 0.35, missing: 0 } },
                { field_value_factor: { field: "average_rating", factor: 0.2, missing: 0 } },
                { filter: { term: { bestSeller: true } }, weight: 1.2 },
                { filter: { term: { isFeatured: true } }, weight: 0.6 },
            ],
        },
    };
};

const buildEsSort = ({ search, orderBy, order, sort } = {}) => {
    const stripIdFielddata = (clauses) =>
        (Array.isArray(clauses) ? clauses : [])
            .map((clause) => {
                if (!clause || typeof clause !== "object") return null;
                // ES 8+ disallows fielddata / sorting on `_id`.
                if (Object.prototype.hasOwnProperty.call(clause, "_id")) return null;
                return clause;
            })
            .filter(Boolean);

    if (Array.isArray(sort) && sort.length) {
        const cleaned = stripIdFielddata(sort);
        return cleaned.length ? cleaned : [{ date_created_utc: { order: "desc" } }];
    }
    if (sort && typeof sort === "object") {
        const cleaned = stripIdFielddata([sort]);
        return cleaned.length ? cleaned : [{ date_created_utc: { order: "desc" } }];
    }

    const q = normalizeSearchQuery(search);
    const field = String(orderBy || "").trim();

    if (field === "relevance" || field === "_score") {
        if (q) {
            return [
                { _score: { order: "desc" } },
                { sold_count: { order: "desc", missing: "_last" } },
                { date_created_utc: { order: "desc" } },
            ];
        }
        return [{ date_created_utc: { order: "desc" } }];
    }

    let esField = field || "date_created_utc";
    if (esField === "name" || esField.startsWith("name.")) {
        esField = "date_created_utc";
    }

    const esOrder = order === 1 || order === "1" || order === "asc" ? "asc" : "desc";
    if (q) {
        return [
            { _score: { order: "desc" } },
            { [esField]: { order: esOrder } },
            { sold_count: { order: "desc", missing: "_last" } },
            { date_created_utc: { order: "desc" } },
        ];
    }
    return [{ [esField]: { order: esOrder } }];
};

const applyCategoryFilter = async (boolFilter, { categoryId, categoryIds } = {}) => {
    let ids = Array.isArray(categoryIds) && categoryIds.length
        ? categoryIds
        : [];
    if (!ids.length && categoryId) {
        ids = await expandCategoryFilterIds(categoryId);
    }
    const clause = buildEsCategoryFilter(ids);
    if (clause) boolFilter.push(clause);
};

const applySingleCategoryFilter = (boolFilter, singleCategoryOnly) => {
    if (!singleCategoryOnly) return;
    boolFilter.push({
        script: {
            script: {
                source: "doc['categories'].size() == 1",
            },
        },
    });
};

module.exports = {
    filter: async ({ limit, skip, sort, search, category, categoryIds, orderBy, order, singleCategoryOnly = false, minSoldCount } = {}) => {
        const bool = {
            filter: [{ term: { status: "active" } }],
        };
        const minSold = Number(minSoldCount);
        if (Number.isFinite(minSold) && minSold > 0) {
            bool.filter.push({ range: { sold_count: { gte: minSold } } });
        }
        await applyCategoryFilter(bool.filter, { categoryId: category, categoryIds });
        applySingleCategoryFilter(bool.filter, singleCategoryOnly);

        const searchQuery = buildSearchQuery(search);
        if (searchQuery) bool.must = [buildFunctionScore(searchQuery)];
        const q = normalizeSearchQuery(search);
        if (q && global._model?.FrequentlySearch?.set) {
            void _model.FrequentlySearch.set(q).catch(() => {});
        }

        const resolvedSort = buildEsSort({ search, orderBy, order, sort });

        return productIndex.search({ bool }, {
            limit,
            skip,
            sort: resolvedSort,
        });
    },

    list: async (query) => {
        const esQuery = {
            bool: {
                filter: [{ term: { status: "active" } }],
            },
        };

        await applyCategoryFilter(esQuery.bool.filter, {
            categoryId: query?.category,
            categoryIds: query?.categoryIds,
        });
        applySingleCategoryFilter(esQuery.bool.filter, query?.singleCategoryOnly);

        const searchQuery = buildSearchQuery(query?.search);
        if (searchQuery) {
            esQuery.bool.must = [buildFunctionScore(searchQuery)];
        }
        const q = normalizeSearchQuery(query?.search);
        if (q && global._model?.FrequentlySearch?.set) {
            void _model.FrequentlySearch.set(q).catch(() => {});
        }

        if (query?.fieldName && query?.fieldValue !== undefined && query?.fieldValue !== null && String(query.fieldValue).trim() !== "") {
            esQuery.bool.must = esQuery.bool.must || [];
            esQuery.bool.must.push({
                term: { [query.fieldName]: query.fieldValue },
            });
        }

        const resolvedSort = buildEsSort({
            search: query?.search,
            orderBy: query?.orderBy,
            order: query?.order,
            sort: query?.sort,
        });

        return productIndex.search(esQuery, {
            limit: query?.limit,
            skip: query?.skip,
            sort: resolvedSort,
            source: query?.source,
        });
    },
};
