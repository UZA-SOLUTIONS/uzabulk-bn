/**

 * Image search: 1688 imageQuery (+ smart listing keywords) → DashScope VL → local FAISS.

 * Google Vision is disabled by default (set GOOGLE_IMAGE_SEARCH_ENABLED=true to re-enable).

 */

const { resolveImageSearchFromAi } = require("../../ai/services/aiImageSearchService");

const fs = require("fs");
const path = require("path");

const { searchGoogleImageKeywords } = require("../services/googleImageSearch");

const { searchLocalImage, searchLocalImageLive, isLocalImageSearchEnabled } = require("../services/localImageSearch");

const {

    searchImageQuery,

    searchDomesticSimilarImageOffers,

    searchSameOffers,

    searchRelatedRecommend,

    searchSimilarSupplyOffers,

    extractImageSearchOffers,

    extractDomesticImageSearchOffers,

    mapOfferToProductStub,

    isConfigured: isAlibabaConfigured,

} = require("../services/alibaba");

const { resolveAlibabaImageSearchInput, buildDomesticImageParams } = require("./resolveAlibabaImageInput");

const esProductService = require("../services/esProductService");

const { guessLocalImagePath } = require("../../ai/helpers/resolveVisionImageInput");
const { isMongoConnected } = require("../../../config/db");
const { withPromiseTimeout } = require("../../../utils/mongoQueryOptions");

const IMAGE_SEARCH_MONGO_BUDGET_MS = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_MONGO_BUDGET_MS || 12000), 3000),
    25000
);
const ALIBABA_SEARCH_BUDGET_MS = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_ALIBABA_BUDGET_MS || 18000), 5000),
    45000
);
const ALIBABA_ENHANCED_BUDGET_MS = Math.min(
    Math.max(
        Number(process.env.IMAGE_SEARCH_1688_ENHANCED_BUDGET_MS || ALIBABA_SEARCH_BUDGET_MS * 2),
        ALIBABA_SEARCH_BUDGET_MS
    ),
    60000
);

const is1688EnhancedImageSearchEnabled = () => {
    if (!isAlibabaConfigured()) return false;
    const enhanced = String(process.env.IMAGE_SEARCH_1688_ENHANCED ?? "false").toLowerCase();
    return enhanced === "1" || enhanced === "true";
};

const merge1688OfferRows = (bundles = []) => {
    const merged = [];
    const seen = new Set();
    (bundles || []).forEach(({ rows = [], source, baseScore = 0 }) => {
        rows.forEach((row, index) => {
            const offerId = String(row?.offerId || row?.offer_id || "").trim();
            if (!offerId || seen.has(offerId)) return;
            seen.add(offerId);
            merged.push({
                ...row,
                _1688Source: source,
                _1688RankScore: baseScore - index * 0.05,
            });
        });
    });
    merged.sort((a, b) => (b._1688RankScore || 0) - (a._1688RankScore || 0));
    return merged;
};

const attach1688RankScores = (items = [], rankedOffers = []) => {
    const rankByOffer = new Map(
        rankedOffers.map((row) => [String(row?.offerId || "").trim(), Number(row?._1688RankScore || 0)])
    );
    const sourceByOffer = new Map(
        rankedOffers.map((row) => [String(row?.offerId || "").trim(), row?._1688Source || "imageQuery"])
    );

    return (items || []).map((item) => {
        const offerId = String(item?.offerId || "").trim();
        const rankScore = rankByOffer.get(offerId) || 0;
        if (!rankScore) return item;
        const source = sourceByOffer.get(offerId) || "imageQuery";
        return {
            ...item,
            match_score: Number((rankScore + Number(item.match_score || 0)).toFixed(4)),
            match_type: item.match_type || `alibaba_${source}`,
            alibaba_source: source,
        };
    }).sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0));
};

const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const stubsFromOffers = (offers = [], pageLimit = 32) => {
    const merged = [];
    const seen = new Set();
    offers.forEach((row) => {
        const offerId = String(row?.offerId || "").trim();
        if (!offerId || seen.has(offerId)) return;
        seen.add(offerId);
        const stub = mapOfferToProductStub(row);
        if (stub) merged.push(stub);
    });
    return merged.slice(0, pageLimit);
};

const isGoogleImageSearchEnabled = () => {

    const flag = String(process.env.GOOGLE_IMAGE_SEARCH_ENABLED ?? "false").toLowerCase();

    return flag === "1" || flag === "true";

};



const imageProjection = {

    name: 1,

    price: 1,

    compare_price: 1,

    featured_image: 1,

    average_rating: 1,

    rating_count: 1,

    short_description: 1,

    offerId: 1,

    slug: 1,

    categories: 1,

};



const unwrapEsSearchResult = (result) => {

    if (Array.isArray(result)) {

        return { items: result, total: 0 };

    }

    return {

        items: result?.items || [],

        total: typeof result?.total === "number" ? result.total : 0,

    };

};



const mapProductsByOfferOrder = async (offerIds = []) => {

    const uniq = [...new Set(

        (offerIds || []).map((id) => String(id || "").trim()).filter(Boolean)

    )];

    if (!uniq.length) return [];



    const found = await _model.Product.find({
        status: "active",
        offerId: { $in: uniq },
    })
        .select(imageProjection)
        .lean();



    const byOffer = new Map(found.map((p) => [String(p.offerId), p]));

    const items = [];

    uniq.forEach((id) => {

        const p = byOffer.get(id);

        if (!p) return;

        const img = p.featured_image;

        items.push(

            img && typeof img === "object" && img.link

                ? { ...p, featured_image: img.link }

                : { ...p }

        );

    });

    return items;

};



const VISUAL_MATCH_SCORE_BASE = Number(process.env.LOCAL_IMAGE_SEARCH_SCORE_BASE || 8);

const attachVisualMatchScores = (items = [], visualResults = []) => {
    const scoreByOffer = new Map(
        (visualResults || []).map((row) => [
            String(row?.offerId || "").trim(),
            Number(row?.similarity || 0),
        ])
    );

    return (items || []).map((item) => {
        const offerId = String(item?.offerId || "").trim();
        const similarity = scoreByOffer.get(offerId) || 0;
        if (!similarity) return item;
        return {
            ...item,
            similarity_score: Number(similarity.toFixed(4)),
            match_score: Number((VISUAL_MATCH_SCORE_BASE + similarity * 10).toFixed(4)),
            match_type: "visual",
        };
    });
};

const mapProductsByVisualResults = async (visualResults = [], pageLimit = 32) => {
    const offerIds = (visualResults || [])
        .map((row) => String(row?.offerId || "").trim())
        .filter(Boolean);
    if (!offerIds.length) return [];

    const items = attachVisualMatchScores(
        await mapProductsByOfferOrder(offerIds),
        visualResults
    );
    return items.slice(0, pageLimit);
};



const resolveActiveCatalogItems = async (items = []) => {

    if (!Array.isArray(items) || !items.length) return [];



    const mongoIds = [];

    const offerIds = [];



    items.forEach((item) => {

        const mongoId = String(item?._id || "").trim();

        const offerId = String(item?.offerId || "").trim();

        if (looksLikeObjectId(mongoId)) mongoIds.push(mongoId);

        if (offerId) offerIds.push(offerId);

    });



    if (!mongoIds.length && !offerIds.length) return [];



    const orQuery = [];

    if (mongoIds.length) orQuery.push({ _id: { $in: [...new Set(mongoIds)] } });

    if (offerIds.length) orQuery.push({ offerId: { $in: [...new Set(offerIds)] } });



    const activeProducts = await _model.Product.find({

        status: "active",

        $or: orQuery,

    })

        .select(imageProjection)

        .populate({ path: "featured_image", select: "link -_id" })

        .populate({ path: "variations", select: "-meta_data", options: { lean: true } })

        .lean();



    const byId = new Map();

    const byOffer = new Map();

    activeProducts.forEach((p) => {

        byId.set(String(p._id), p);

        if (p.offerId) byOffer.set(String(p.offerId), p);

    });



    const seen = new Set();

    const resolved = [];

    items.forEach((item) => {

        const mongoId = String(item?._id || "").trim();

        const offerId = String(item?.offerId || "").trim();

        const match = (looksLikeObjectId(mongoId) && byId.get(mongoId))

            || (offerId && byOffer.get(offerId));

        if (!match) return;

        const key = String(match._id);

        if (seen.has(key)) return;

        seen.add(key);

        const img = match.featured_image;

        resolved.push(

            img && typeof img === "object" && img.link

                ? { ...match, featured_image: img.link }

                : { ...match }

        );

    });

    return resolved;

};



const mergeCatalogAndStubs = async (offers = [], pageLimit = 32) => {
    if (!offers.length) return [];

    const offerIds = offers
        .map((row) => String(row?.offerId || "").trim())
        .filter(Boolean);

    if (!isMongoConnected()) {
        return stubsFromOffers(offers, pageLimit);
    }

    let catalogItems = [];
    try {
        catalogItems = await withPromiseTimeout(
            mapProductsByOfferOrder(offerIds),
            IMAGE_SEARCH_MONGO_BUDGET_MS,
            []
        );
    } catch (error) {
        console.warn("[image-search] catalog offer lookup failed:", error?.message || error);
    }

    if (!catalogItems.length) {
        return stubsFromOffers(offers, pageLimit);
    }

    const catalogByOffer = new Map(catalogItems.map((item) => [String(item.offerId), item]));
    const merged = [];
    const seen = new Set();

    offers.forEach((row) => {
        const offerId = String(row?.offerId || "").trim();
        if (!offerId || seen.has(offerId)) return;
        seen.add(offerId);

        const catalogItem = catalogByOffer.get(offerId);
        if (catalogItem) {
            merged.push(catalogItem);
            return;
        }

        const stub = mapOfferToProductStub(row);
        if (stub) merged.push(stub);
    });

    return merged.slice(0, pageLimit);
};



const buildLocalVision = (matchedItems = []) => {
    const topName = String(matchedItems[0]?.name || "").trim();
    if (!topName || topName === "Product") return null;
    const label = topName.split(/\s+/).slice(0, 5).join(" ");
    return {
        provider: "local-visual",
        objectLabel: label,
        primaryKeyword: label,
        keywords: topName.split(/\s+/).filter((word) => word.length > 2).slice(0, 6),
        searchPhrase: topName,
    };
};

const runLocalVisualSearch = async ({ imageAddress, pageLimit = 32 } = {}) => {
    const imageUrl = String(imageAddress || "").trim();
    if (!imageUrl || !isLocalImageSearchEnabled()) return null;

    const indexPath = process.env.LOCAL_IMAGE_SEARCH_INDEX
        || path.resolve(process.cwd(), "data", "image-search", "products.index.faiss");
    const hasIndex = fs.existsSync(indexPath);
    const liveEnabled = String(process.env.LOCAL_IMAGE_SEARCH_LIVE_ENABLED ?? "true").toLowerCase() !== "false";

    try {
        if (hasIndex) {
            const localImageSearch = await searchLocalImage({ imageAddress: imageUrl, limit: pageLimit });
            if (localImageSearch?.results?.length) {
                const items = await mapProductsByVisualResults(localImageSearch.results, pageLimit);
                if (items.length) {
                    return {
                        items,
                        provider: localImageSearch.provider || "local-visual",
                        vision: buildLocalVision(items),
                        total: items.length,
                    };
                }
            }
        }
    } catch (localErr) {
        console.warn("[image-search] Local index failed:", localErr?.message || localErr);
    }

    if (!liveEnabled || !isMongoConnected()) {
        return null;
    }

    try {
        const livePool = Math.min(
            Math.max(Number(process.env.LOCAL_IMAGE_SEARCH_LIVE_CANDIDATES || 120), 20),
            300
        );
        const liveCandidates = await _model.Product.find({ status: "active" })
            .select("offerId name featured_image images")
            .sort({ sold_count: -1, date_created_utc: -1 })
            .limit(livePool)
            .lean();

        const candidateRows = [];
        liveCandidates.forEach((product) => {
            const offerId = String(product?.offerId || "").trim();
            if (!offerId) return;
            const urls = [];
            const addUrl = (value) => {
                const url = typeof value === "string" ? value.trim() : "";
                if (url && !urls.includes(url)) urls.push(url);
            };
            addUrl(product?.featured_image);
            (product?.images || []).forEach(addUrl);
            urls.slice(0, 3).forEach((imageUrl) => {
                candidateRows.push({ offerId, name: product?.name || "", imageUrl });
            });
        });

        const localLive = await searchLocalImageLive({
            imageAddress: imageUrl,
            limit: pageLimit,
            candidates: candidateRows,
        });

        if (localLive?.results?.length) {
            const items = await mapProductsByVisualResults(localLive.results, pageLimit);
            if (items.length) {
                return {
                    items,
                    provider: localLive.provider || "local-live",
                    vision: buildLocalVision(items),
                    total: items.length,
                };
            }
        }
    } catch (liveErr) {
        console.warn("[image-search] Local live failed:", liveErr?.message || liveErr);
    }

    return null;
};



const runAlibabaImageSearch = async ({
    imageUrl,
    pageLimit,
    pageSkip,
    country,
} = {}) => {
    const imageInput = await resolveAlibabaImageSearchInput(imageUrl);
    if (!imageInput) {
        console.warn("[1688] image search input could not be prepared for:", String(imageUrl || "").slice(0, 96));
        return null;
    }

    const beginPage = Math.max(1, Number(pageSkip) || 1);
    const alibabaResult = await withPromiseTimeout(
        searchImageQuery({
            ...imageInput,
            beginPage,
            pageSize: pageLimit,
            country: String(country || "en").trim() || "en",
        }),
        ALIBABA_SEARCH_BUDGET_MS,
        null
    );

    const offers = extractImageSearchOffers(alibabaResult);
    if (!offers.length) {
        console.warn(
            "[1688] imageQuery returned no offers",
            alibabaResult ? `keys=${Object.keys(alibabaResult).join(",")}` : "(null response)"
        );
        return null;
    }

    const items = await mergeCatalogAndStubs(offers, pageLimit);
    if (!items.length) {
        console.warn(`[1688] imageQuery had ${offers.length} offers but 0 items after merge`);
    }

    const totalRecords = Number(

        alibabaResult?.totalRecords

        ?? alibabaResult?.data?.totalRecords

        ?? items.length

    ) || items.length;

    const topSubject = String(
        offers[0]?.subjectTrans || offers[0]?.subject || offers[0]?.title || items[0]?.name || ""
    ).trim();
    const keywords = offers
        .slice(0, 5)
        .map((row) => String(row?.subjectTrans || row?.subject || "").trim())
        .filter(Boolean);



    return {

        items,

        provider: "alibaba",

        vision: topSubject ? {

            provider: "alibaba-image-search",

            objectLabel: topSubject,

            primaryKeyword: topSubject,

            keywords,

            searchPhrase: topSubject,

        } : null,

        total: totalRecords,

    };

};

/** Multi-API 1688 image search: imageQuery + domestic similar + sameOffers + related + supply. */
const runEnhanced1688ImageSearch = async ({
    imageUrl,
    pageLimit,
    pageSkip,
    country,
    imageKeywords = "",
} = {}) => {
    const imageInput = await resolveAlibabaImageSearchInput(imageUrl);
    if (!imageInput && !String(imageUrl || "").trim()) {
        return null;
    }

    const beginPage = Math.max(1, Number(pageSkip) || 1);
    const keywordHint = String(imageKeywords || "").trim();
    const domesticParams = buildDomesticImageParams(imageInput, imageUrl, keywordHint);

    const [imageQueryResult, domesticResult] = await Promise.all([
        imageInput
            ? withPromiseTimeout(
                searchImageQuery({
                    ...imageInput,
                    beginPage,
                    pageSize: pageLimit,
                    country: String(country || "en").trim() || "en",
                    imageKeywords: keywordHint,
                }),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            )
            : Promise.resolve(null),
        domesticParams
            ? withPromiseTimeout(
                searchDomesticSimilarImageOffers(domesticParams),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            )
            : Promise.resolve(null),
    ]);

    const imageQueryOffers = extractImageSearchOffers(imageQueryResult || {});
    const domesticOffers = extractDomesticImageSearchOffers(domesticResult || {});

    const bundles = [
        { rows: imageQueryOffers, source: "imageQuery", baseScore: 10 },
        { rows: domesticOffers, source: "domesticSimilar", baseScore: 9 },
    ];

    const seedOfferId = String(
        imageQueryOffers[0]?.offerId || domesticOffers[0]?.offerId || ""
    ).trim();

    if (seedOfferId) {
        const expandSize = Math.min(Math.max(pageLimit, 10), 20);
        const [sameResult, relatedResult, supplyResult] = await Promise.all([
            withPromiseTimeout(
                searchSameOffers({
                    offerId: seedOfferId,
                    ...(imageInput || {}),
                    keyword: keywordHint,
                    beginPage,
                    pageSize: expandSize,
                    country,
                }),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            ),
            withPromiseTimeout(
                searchRelatedRecommend({ offerId: seedOfferId, pageSize: expandSize, country }),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            ),
            withPromiseTimeout(
                searchSimilarSupplyOffers({ offerId: seedOfferId, pageSize: expandSize, country }),
                ALIBABA_ENHANCED_BUDGET_MS,
                null
            ),
        ]);

        bundles.push(
            { rows: extractImageSearchOffers(sameResult || {}), source: "sameOffers", baseScore: 8 },
            { rows: extractImageSearchOffers(supplyResult || {}), source: "supplySimilar", baseScore: 7 },
            { rows: extractImageSearchOffers(relatedResult || {}), source: "relatedRecommend", baseScore: 6 },
        );
    }

    const rankedOffers = merge1688OfferRows(bundles);
    if (!rankedOffers.length) {
        const activeSources = bundles.filter((b) => b.rows.length).map((b) => b.source);
        console.warn(
            "[1688] enhanced image search returned no offers",
            activeSources.length ? `partial sources=${activeSources.join(",")}` : ""
        );
        return null;
    }

    const items = attach1688RankScores(
        await mergeCatalogAndStubs(rankedOffers, pageLimit),
        rankedOffers
    );

    const sources = bundles
        .filter((b) => b.rows.length)
        .map((b) => ({ source: b.source, count: b.rows.length }));

    console.log(
        `[1688] enhanced image search offers=${rankedOffers.length} catalog=${items.length} sources=${sources.map((s) => `${s.source}:${s.count}`).join(",")}`
    );

    const topSubject = String(
        rankedOffers[0]?.subjectTrans || rankedOffers[0]?.subject || items[0]?.name || ""
    ).trim();
    const keywords = rankedOffers
        .slice(0, 5)
        .map((row) => String(row?.subjectTrans || row?.subject || "").trim())
        .filter(Boolean);

    const totalRecords = Number(
        imageQueryResult?.totalRecords
        ?? imageQueryResult?.data?.totalRecords
        ?? items.length
    ) || items.length;

    return {
        items: items.slice(0, pageLimit),
        provider: "alibaba-enhanced",
        vision: topSubject ? {
            provider: "alibaba-image-search",
            objectLabel: topSubject,
            primaryKeyword: topSubject,
            keywords,
            searchPhrase: topSubject,
        } : null,
        total: totalRecords,
        sources,
    };
};



/**

 * @returns {Promise<{ items: Array, provider: string, vision?: object, total?: number }>}

 */

const runImageSearchPipeline = async ({

    imageUrl,

    limit = 32,

    skip = 1,

    category,

    fieldName,

    fieldValue,

    country = "en",

    skipGoogle = true,

} = {}) => {

    const imageAddress = String(imageUrl || "").trim();

    if (!imageAddress) {

        return { items: [], provider: "none", vision: null, total: 0 };

    }



    const pageSkip = Math.max(1, Number(skip) || 1);

    const pageLimit = Math.max(1, Number(limit) || 32);



    if (guessLocalImagePath(imageAddress) || isLocalImageSearchEnabled()) {
        try {
            const localMatch = await runLocalVisualSearch({ imageAddress, pageLimit });
            if (localMatch?.items?.length) {
                return localMatch;
            }
        } catch (localEarlyErr) {
            console.warn("[image-search] Local visual match failed:", localEarlyErr?.message || localEarlyErr);
        }
    }



    // 1. 1688 cross-border image search (remote/public images only)

    if (!guessLocalImagePath(imageAddress)) {

    try {

        const alibabaSearch = is1688EnhancedImageSearchEnabled()
            ? await runEnhanced1688ImageSearch({
                imageUrl: imageAddress,
                pageLimit,
                pageSkip,
                country,
            })
            : await runAlibabaImageSearch({
                imageUrl: imageAddress,
                pageLimit,
                pageSkip,
                country,
            });

        if (alibabaSearch?.items?.length) {

            return alibabaSearch;

        }

    } catch (alibabaErr) {

        console.warn("[image-search] 1688 imageQuery failed:", alibabaErr?.message || alibabaErr);

    }

    }



    // 2. DashScope Qwen-VL smart listing keywords → catalog

    try {

        const aiImageResult = await resolveImageSearchFromAi({

            imageAddress,

            limit: pageLimit,

            skip: pageSkip,

            category,

            fieldName,

            fieldValue,

        });

        if (aiImageResult?.vision?.primaryKeyword) {

            let items = await resolveActiveCatalogItems(aiImageResult.items || []);

            if (!items.length && aiImageResult.items?.length) {
                items = aiImageResult.items;
            }

            items = items.slice(0, pageLimit);

            if (items.length) {

                return {

                    items,

                    provider: "smart-listing",

                    vision: aiImageResult.vision,

                    total: items.length ? 500 : 0,

                };

            }

        }

    } catch (aiErr) {

        console.warn("[image-search] DashScope smart listing failed:", aiErr?.message || aiErr);

    }



    // 3. Google Vision (opt-in only)

    if (!skipGoogle && isGoogleImageSearchEnabled()) {

        try {

            const googleImageSearch = await searchGoogleImageKeywords({ imageAddress });

            if (googleImageSearch?.primaryKeyword) {

                const googleSearchQuery = {

                    category, fieldName, fieldValue,

                    search: googleImageSearch.primaryKeyword,

                    limit: pageLimit,

                    skip: pageSkip,

                };

                let googleRawItems = unwrapEsSearchResult(

                    await esProductService.list(googleSearchQuery)

                ).items;



                if (googleRawItems.length < pageLimit && Array.isArray(googleImageSearch.keywords)) {

                    const seen = new Set(googleRawItems.map((i) => String(i?._id || i?.offerId || "")));

                    for (const keyword of googleImageSearch.keywords.slice(1, 4)) {

                        if (!keyword) continue;

                        const { items: extra } = unwrapEsSearchResult(

                            await esProductService.list({

                                ...googleSearchQuery,

                                search: keyword,

                                skip: 1,

                                limit: pageLimit,

                            })

                        );

                        extra.forEach((item) => {

                            const key = String(item?._id || item?.offerId || "");

                            if (!key || seen.has(key)) return;

                            seen.add(key);

                            googleRawItems.push(item);

                        });

                        if (googleRawItems.length >= pageLimit) break;

                    }

                }



                let items = await resolveActiveCatalogItems(googleRawItems);

                items = items.slice(0, pageLimit);

                if (items.length) {

                    return {

                        items,

                        provider: "google",

                        vision: {

                            primaryKeyword: googleImageSearch.primaryKeyword,

                            keywords: googleImageSearch.keywords || [],

                            searchPhrase: googleImageSearch.primaryKeyword,

                        },

                        total: items.length ? 500 : 0,

                    };

                }

            }

        } catch (googleErr) {

            console.warn("[image-search] Google failed:", googleErr?.message || googleErr);

        }

    }



    // 4. Local FAISS / live match for remote image URLs

    if (!guessLocalImagePath(imageAddress)) {
        const localMatch = await runLocalVisualSearch({ imageAddress, pageLimit });
        if (localMatch?.items?.length) {
            return localMatch;
        }
    }



    return { items: [], provider: "none", vision: null, total: 0 };

};



const searchAlibabaCatalogByKeywords = async ({
    primaryKeyword,
    keywords = [],
    pageLimit = 32,
    pageSkip = 1,
    country = "en",
} = {}) => {
    const { searchOffersByKeywords } = require("../services/alibaba");
    const offers = await withPromiseTimeout(
        searchOffersByKeywords({
            keyword: primaryKeyword,
            keywords,
            beginPage: pageSkip,
            pageSize: pageLimit,
            country,
        }),
        ALIBABA_SEARCH_BUDGET_MS,
        []
    );
    if (!offers.length) {
        console.warn("[1688] keyword search returned no offers for:", primaryKeyword);
        return [];
    }
    const items = await mergeCatalogAndStubs(offers, pageLimit);
    if (!items.length) {
        console.warn(`[1688] keyword search had ${offers.length} offers but 0 items after merge`);
    }
    return items.map((item) => ({
        ...item,
        match_type: item.match_type === "alibaba_image_search"
            ? item.match_type
            : "alibaba_keyword_search",
    }));
};

module.exports = {
    runImageSearchPipeline,
    runAlibabaImageSearch,
    runEnhanced1688ImageSearch,
    is1688EnhancedImageSearchEnabled,
    runLocalVisualSearch,
    searchAlibabaCatalogByKeywords,
    resolveActiveCatalogItems,
    mapProductsByOfferOrder,
    mergeCatalogAndStubs,
};


