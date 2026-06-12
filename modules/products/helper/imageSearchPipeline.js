/**

 * Image search: 1688 imageQuery (+ smart listing keywords) → DashScope VL → local FAISS.

 * Google Vision is disabled by default (set GOOGLE_IMAGE_SEARCH_ENABLED=true to re-enable).

 */

const { resolveImageSearchFromAi } = require("../../ai/services/aiImageSearchService");

const { searchGoogleImageKeywords } = require("../services/googleImageSearch");

const { searchLocalImage, searchLocalImageLive } = require("../services/localImageSearch");

const {

    searchImageQuery,

    extractImageSearchOffers,

    mapOfferToProductStub,

} = require("../services/alibaba");

const { resolveAlibabaImageSearchInput } = require("./resolveAlibabaImageInput");

const esProductService = require("../services/esProductService");

const { guessLocalImagePath } = require("../../ai/helpers/resolveVisionImageInput");



const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());



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

        .populate({ path: "featured_image", select: "link -_id" })

        .populate({ path: "variations", select: "-meta_data", options: { lean: true } })

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

    const offerIds = offers

        .map((row) => String(row?.offerId || "").trim())

        .filter(Boolean);

    const catalogItems = await mapProductsByOfferOrder(offerIds);

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



const runAlibabaImageSearch = async ({

    imageUrl,

    pageLimit,

    pageSkip,

    country,

} = {}) => {

    const imageInput = await resolveAlibabaImageSearchInput(imageUrl);

    if (!imageInput) {

        return null;

    }



    const beginPage = Math.max(1, Number(pageSkip) || 1);

    const alibabaResult = await searchImageQuery({

        ...imageInput,

        beginPage,

        pageSize: pageLimit,

        country: String(country || "en").trim() || "en",

    });



    const offers = extractImageSearchOffers(alibabaResult);

    if (!offers.length) {

        return null;

    }



    const items = await mergeCatalogAndStubs(offers, pageLimit);

    const totalRecords = Number(

        alibabaResult?.totalRecords

        ?? alibabaResult?.data?.totalRecords

        ?? items.length

    ) || items.length;



    return {

        items,

        provider: "alibaba",

        vision: {

            provider: "alibaba-image-search",

            primaryKeyword: "",

            keywords: [],

            searchPhrase: "",

        },

        total: totalRecords,

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



    // 1. 1688 cross-border image search (upload local file → imageId → imageQuery)

    try {

        const alibabaSearch = await runAlibabaImageSearch({

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



    // 4. Local FAISS index

    const hasLocalUpload = Boolean(guessLocalImagePath(imageAddress));

    if (!hasLocalUpload) {

        try {

            const localImageSearch = await searchLocalImage({ imageAddress, limit: pageLimit });

            if (localImageSearch?.offerIds?.length) {

                const items = (await mapProductsByOfferOrder(localImageSearch.offerIds)).slice(0, pageLimit);

                if (items.length) {

                    return { items, provider: "local", vision: null, total: items.length };

                }

            }

        } catch (localErr) {

            console.warn("[image-search] Local index failed:", localErr?.message || localErr);

        }



        // 5. Live local CLIP match

        try {

            const liveCandidates = await _model.Product.find({ status: "active" })

                .select("offerId name featured_image")

                .populate({ path: "featured_image", select: "link -_id" })

                .sort({ date_created_utc: -1 })

                .limit(120)

                .lean();

            const localLive = await searchLocalImageLive({

                imageAddress,

                limit: pageLimit,

                candidates: liveCandidates.map((p) => ({

                    offerId: p?.offerId,

                    name: p?.name,

                    imageUrl: typeof p?.featured_image === "string" ? p.featured_image : p?.featured_image?.link,

                })),

            });

            if (localLive?.offerIds?.length) {

                const items = (await mapProductsByOfferOrder(localLive.offerIds)).slice(0, pageLimit);

                if (items.length) {

                    return { items, provider: "local", vision: null, total: items.length };

                }

            }

        } catch (liveErr) {

            console.warn("[image-search] Local live failed:", liveErr?.message || liveErr);

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
    const offers = await searchOffersByKeywords({
        keyword: primaryKeyword,
        keywords,
        beginPage: pageSkip,
        pageSize: pageLimit,
        country,
    });
    if (!offers.length) return [];
    const items = await mergeCatalogAndStubs(offers, pageLimit);
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
    searchAlibabaCatalogByKeywords,
    resolveActiveCatalogItems,
    mapProductsByOfferOrder,
    mergeCatalogAndStubs,
};


