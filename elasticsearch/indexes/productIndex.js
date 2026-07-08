const esClient = require("../esConfig");
const esHelper = require("../esHelper");
const {
    isElasticConfigured,
    isElasticsearchReachable,
    getElasticsearchAvailability,
    logElasticsearchSearchError,
} = require("../availability");
const _ = require('lodash');

const INDEX_ALIAS = "products";
const INDEX_PREFIX = "products_v2";
const buildVersionedIndexName = () =>
    `${INDEX_PREFIX}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

const isElasticSearchConfigured = () => Boolean(String(global.env?.ELASTIC_SEARCH?.BASE_URL || "").trim());

const normalizeCategoryIdsForEs = (categories = []) => {
    if (!Array.isArray(categories)) return [];
    return [...new Set(
        categories
            .map((entry) => String(entry?._id || entry || "").trim())
            .filter((id) => /^[a-fA-F0-9]{24}$/.test(id))
    )];
};

const indexMapping = {
    settings: {
        analysis: {
            normalizer: {
                lowercase_normalizer: {
                    type: "custom",
                    filter: ["lowercase", "asciifolding"],
                },
            },
            filter: {
                edge_ngram_filter: {
                    type: "edge_ngram",
                    min_gram: 2,
                    max_gram: 20,
                },
            },
            analyzer: {
                product_text_analyzer: {
                    tokenizer: "standard",
                    filter: ["lowercase", "asciifolding"],
                },
                product_prefix_index_analyzer: {
                    tokenizer: "standard",
                    filter: ["lowercase", "asciifolding", "edge_ngram_filter"],
                },
                product_prefix_search_analyzer: {
                    tokenizer: "standard",
                    filter: ["lowercase", "asciifolding"],
                },
            },
        },
    },
    mappings: {
        properties: {
            name: {
                type: "text",
                analyzer: "product_text_analyzer",
                fields: {
                    keyword: { type: "keyword", normalizer: "lowercase_normalizer" },
                    prefix: {
                        type: "text",
                        analyzer: "product_prefix_index_analyzer",
                        search_analyzer: "product_prefix_search_analyzer",
                    },
                },
            },
            slug: { type: "keyword", normalizer: "lowercase_normalizer" },
            sku: { type: "keyword", normalizer: "lowercase_normalizer" },
            offerId: { type: "keyword", normalizer: "lowercase_normalizer" },
            short_description: { type: "text", analyzer: "product_text_analyzer" },
            description: { type: "text", analyzer: "product_text_analyzer" },
            status: { type: "keyword" },
            isFeatured: { type: "boolean" },
            bestSeller: { type: "boolean" },
            price: { type: "float" },
            average_rating: { type: "float" },
            sold_count: { type: "integer" },
            date_created_utc: { type: "date" },
            categories: { type: "keyword" },
            topCategoryId: { type: "keyword" },
            price_tiers: {
                type: "nested",
                properties: {
                    startQuantity: { type: "integer", index: false },
                    price: { type: "double", index: false },
                },
            },
            featured_image: { type: "keyword", index: false },
        },
    },
};
module.exports = {
    init: async () => {
        const active = await esHelper.getAliasTargetIndex(INDEX_ALIAS);
        if (active) {
            console.log(`Alias '${INDEX_ALIAS}' already points to '${active}'.`);
            return;
        }

        if (await esHelper.indexExists(INDEX_ALIAS)) {
            console.log(`Legacy index '${INDEX_ALIAS}' exists and will be used as active index.`);
            await esHelper.pointAliasToIndex(INDEX_ALIAS, INDEX_ALIAS);
        } else {
            const indexName = buildVersionedIndexName();
            console.log(`Index '${INDEX_ALIAS}' does not exist. Creating '${indexName}'...`);
            await esHelper.createIndex(indexName, indexMapping);
            await esHelper.pointAliasToIndex(INDEX_ALIAS, indexName);
        }
    },

    sync: async () => {
        const changeStream = _model.Product.watch();

        changeStream.on('change', async (change) => {
            const { operationType, documentKey, fullDocument } = change;

            if (operationType === 'insert' || operationType === 'update' || operationType === 'replace') {
                // Index or update the document in Elasticsearch
                await module.exports.set({ ...fullDocument, _id: documentKey._id });
                console.log(`Document with ID ${documentKey._id} indexed/updated.`);
            } else if (operationType === 'delete') {
                // Remove document from Elasticsearch
                await esClient.delete({
                    index: INDEX_ALIAS,
                    id: documentKey._id.toString()
                });
                console.log(`Document with ID ${documentKey._id} deleted.`);
            }
        });
    },

    set: async (document) => {
        if (!isElasticSearchConfigured()) return;

        await esClient.index({
            index: INDEX_ALIAS,
            id: document._id.toString(),
            body: {
                name: document?.name,
                slug: document?.slug,
                sku: document?.sku,
                short_description: document?.short_description,
                description: document?.description,
                status: document?.status,
                isFeatured: document?.isFeatured,
                bestSeller: document?.bestSeller,
                price: document?.price,
                average_rating: document?.average_rating,
                sold_count: document?.sold_count,
                date_created_utc: document?.date_created_utc,
                categories: normalizeCategoryIdsForEs(document?.categories),
                topCategoryId: document?.topCategoryId ? String(document.topCategoryId) : undefined,
                price_tiers: document?.price_tiers,
                featured_image: document?.featured_image,
                offerId: document?.offerId ? String(document.offerId) : undefined,
            }
        });
    },

    search: async (query = null, options = { limit: 10, skip: 0 }) => {
        if (!isElasticConfigured() || !isElasticsearchReachable()) {
            return { items: [], total: 0, tookMs: 0, timedOut: false };
        }

        try {
            const from = Number.parseInt(options?.skip, 10);
            const size = Number.parseInt(options?.limit, 10);
            const data = await esClient.search({
                index: INDEX_ALIAS,
                sort: options?.sort,
                from: Number.isFinite(from) && from >= 0 ? from : 0,
                size: Number.isFinite(size) && size > 0 ? size : 10,
                track_total_hits: true,
                body: query ? { query } : undefined,
            });

            const totalRaw = data?.hits?.total;
            const total =
                typeof totalRaw === "object" && totalRaw !== null && "value" in totalRaw
                    ? Number(totalRaw.value) || 0
                    : Number(totalRaw) || 0;
            const items = _.map(data?.hits?.hits, (hit) => ({ ...hit._source, _id: hit._id }));
            return {
                items,
                total,
                tookMs: Number(data?.took) || 0,
                timedOut: Boolean(data?.timed_out),
            };
        } catch (error) {
            logElasticsearchSearchError(error);
            return { items: [], total: 0, tookMs: 0, timedOut: false };
        }
    },

    bulkInsert: async (data, options = {}) => {
        try {
            if (!isElasticSearchConfigured()) return;
            if (!data?.length) return;
            if (!(await getElasticsearchAvailability())) return;

            const writeIndex = String(options?.index || INDEX_ALIAS);
            const bulkOps = [];
            data.forEach(doc => {
                bulkOps.push(
                    { update: { _index: writeIndex, _id: doc._id } },
                    {
                        doc: {
                            name: doc?.name,
                            slug: doc?.slug,
                            sku: doc?.sku,
                            offerId: doc?.offerId ? String(doc.offerId) : undefined,
                            short_description: doc?.short_description,
                            description: doc?.description,
                            status: doc?.status,
                            isFeatured: doc?.isFeatured,
                            bestSeller: doc?.bestSeller,
                            price: doc?.price,
                            average_rating: doc?.average_rating,
                            sold_count: doc?.sold_count,
                            date_created_utc: doc?.date_created_utc,
                            categories: normalizeCategoryIdsForEs(doc?.categories),
                            topCategoryId: doc?.topCategoryId ? String(doc.topCategoryId) : undefined,
                            price_tiers: doc?.price_tiers,
                            featured_image: doc?.featured_image,
                        },
                        doc_as_upsert: true
                    }
                );
            });

            const response = await esClient.bulk({ refresh: true, body: bulkOps });

        } catch (error) {
            logElasticsearchSearchError(error);
        }
    }
}

module.exports.indexMapping = indexMapping;