const Product = require("../../../models/productsTable");
const { isDashscopeConfigured } = require("../dashscopeClient");
const { resolveProductImageUrl } = require("../helpers/resolveProductImageUrl");
const { analyzeProductImage, generateListing } = require("./smartListingService");
const { ensureProductEmbedding } = require("../../products/services/similarProductsService");

const META_ENRICHED_AT = "ai_smart_listing_at";

const isAutoSmartListingEnabled = () => {
    if (!isDashscopeConfigured()) return false;
    const flag = String(env?.dashscope?.AUTO_SMART_LISTING ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const getMetaValue = (product, key) => {
    const row = (product.meta_data || []).find((m) => m?.key === key);
    return row?.value != null ? String(row.value) : "";
};

const upsertMeta = (metaData = [], entries = {}) => {
    const map = new Map(
        (metaData || []).map((row) => [String(row.key), String(row.value ?? "")])
    );
    Object.entries(entries).forEach(([key, value]) => {
        if (value == null || value === "") return;
        map.set(key, String(value));
    });
    return [...map.entries()].map(([key, value]) => ({ key, value }));
};

const needsSmartListingEnrichment = (product = {}) => {
    if (getMetaValue(product, META_ENRICHED_AT)) return false;
    if (!resolveProductImageUrl(product)) return false;
    return true;
};

const buildListingUpdates = (product, listing = {}, attributes = {}) => {
    const titleEn = String(listing.title_en || "").trim();
    const descEn = String(listing.description_en || "").trim();
    const shortEn = descEn ? descEn.slice(0, 240) : "";
    const tags = Array.isArray(listing.seo_tags)
        ? listing.seo_tags.map((t) => String(t).trim()).filter(Boolean)
        : [];

    const updates = {
        meta_data: upsertMeta(product.meta_data, {
            [META_ENRICHED_AT]: new Date().toISOString(),
            ai_title_fr: listing.title_fr || "",
            ai_description_fr: listing.description_fr || "",
            ai_moq_suggestion: listing.moq_suggestion ?? "",
            ai_price_usd_suggestion: listing.price_usd_suggestion ?? "",
            ai_attributes_json: JSON.stringify(attributes || {}),
            ai_text_model: listing._model_used || env?.dashscope?.MODEL || "",
        }),
        seoSettings: {
            ...(product.seoSettings || {}),
            title: titleEn || product.seoSettings?.title || product.name,
            metaDescription: shortEn || product.seoSettings?.metaDescription || "",
            metaKeywords: tags.length ? tags.join(", ") : (product.seoSettings?.metaKeywords || ""),
        },
    };

    if (titleEn) {
        updates.name = titleEn;
    }
    if (shortEn) {
        updates.short_description = shortEn;
    }

    const rawDesc = String(product.description || "").trim();
    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(rawDesc);
    if (descEn && (!rawDesc || looksLikeHtml || rawDesc.length < 80)) {
        updates.description = descEn;
    }

    if (listing.moq_suggestion != null && product.min_order_qty == null) {
        const moq = Math.max(1, Math.round(Number(listing.moq_suggestion)));
        if (Number.isFinite(moq)) {
            updates.min_order_qty = moq;
        }
    }

    return updates;
};

/**
 * Auto-generate listing copy from product image and persist on the product record.
 * Runs in background after 1688 sync; no frontend required.
 */
const autoEnrichProductListing = async (productId, { force = false } = {}) => {
    if (!isAutoSmartListingEnabled()) {
        return { skipped: true, reason: "disabled" };
    }

    const product = await Product.findById(productId)
        .select("name short_description description price featured_image images meta_data seoSettings min_order_qty status offerId")
        .populate({ path: "featured_image", select: "link -_id" })
        .lean();

    if (!product || product.status !== "active") {
        return { skipped: true, reason: "inactive" };
    }
    if (!force && !needsSmartListingEnrichment(product)) {
        return { skipped: true, reason: "already_enriched_or_no_image" };
    }

    const imageUrl = resolveProductImageUrl(product);
    if (!imageUrl) {
        return { skipped: true, reason: "no_image" };
    }

    const sourcePriceCNY = product.price != null ? Number(product.price) : null;
    const attributes = await analyzeProductImage(imageUrl);
    const listing = await generateListing(attributes, sourcePriceCNY);
    const updates = buildListingUpdates(product, listing, attributes);

    await Product.updateOne({ _id: productId }, { $set: updates });

    ensureProductEmbedding(productId, { force: true }).catch((err) => {
        console.warn(`Embedding refresh after smart listing failed ${productId}:`, err?.message);
    });

    return {
        enriched: true,
        productId: String(productId),
        offerId: product.offerId || null,
        name: updates.name || product.name,
        model: listing._model_used || env?.dashscope?.MODEL,
    };
};

/**
 * Batch enrich products missing AI listing (cron / manual script).
 */
const backfillAutoSmartListing = async ({ limit = 20, force = false } = {}) => {
    if (!isAutoSmartListingEnabled()) {
        return { processed: 0, skipped: true };
    }

    const query = { status: "active" };
    if (!force) {
        query.$nor = [{ meta_data: { $elemMatch: { key: META_ENRICHED_AT } } }];
    }

    const products = await Product.find(query)
        .select("_id offerId featured_image images meta_data")
        .populate({ path: "featured_image", select: "link -_id" })
        .limit(Math.max(1, Math.min(limit, 100)))
        .lean();

    let processed = 0;
    let errors = 0;
    const results = [];

    for (const product of products) {
        if (!force && getMetaValue(product, META_ENRICHED_AT)) continue;
        if (!resolveProductImageUrl(product)) continue;
        try {
            console.log(`Auto smart listing: ${product._id} (offer ${product.offerId || "n/a"})`);
            const row = await autoEnrichProductListing(product._id, { force });
            if (row.enriched) {
                processed += 1;
                results.push(row);
            }
        } catch (error) {
            errors += 1;
            console.warn(`Auto smart listing failed ${product._id}:`, error?.message || error);
        }
    }

    return { processed, errors, scanned: products.length, results };
};

module.exports = {
    isAutoSmartListingEnabled,
    needsSmartListingEnrichment,
    autoEnrichProductListing,
    backfillAutoSmartListing,
    META_ENRICHED_AT,
};
