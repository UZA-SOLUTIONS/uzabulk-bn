const TARGET_MARKETS_DEFAULT = "Rwanda, Nigeria, Kenya";
const CNY_PER_USD = () => Number(process.env.CNY_PER_USD || 7.2);

const asStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean);
    }
    const single = String(value || "").trim();
    return single ? [single] : [];
};

/**
 * Normalize VL JSON into a consistent buyer-side attribute object.
 */
const normalizeBuyerAttributes = (raw = {}) => {
    const color = asStringArray(raw.color);
    const styleKeywords = asStringArray(raw.style_keywords || raw.styleKeywords);
    const condition = String(raw.condition || "new").toLowerCase();
    const estimatedPriceUsd = Number(raw.estimated_price_usd ?? raw.estimatedPriceUsd);

    return {
        category: String(raw.category || raw.product_type || "").trim(),
        color,
        material: String(raw.material || "").trim(),
        style_keywords: styleKeywords,
        condition: condition === "used" ? "used" : "new",
        estimated_price_usd: Number.isFinite(estimatedPriceUsd) ? estimatedPriceUsd : null,
        product_type: String(raw.product_type || raw.category || "").trim(),
        visible_text: String(raw.visible_text || "").trim(),
        size: String(raw.size || "").trim(),
    };
};

/**
 * Text fed into Qwen3-Embedding for attribute-based visual search.
 */
const buildAttributesEmbeddingText = (attributes = {}) => {
    const attrs = normalizeBuyerAttributes(attributes);
    const parts = [
        attrs.product_type,
        attrs.category,
        attrs.material,
        ...attrs.color,
        ...attrs.style_keywords,
        attrs.size,
        attrs.visible_text,
        attrs.condition,
    ].filter(Boolean);

    if (attrs.estimated_price_usd != null) {
        parts.push(`price tier ${attrs.estimated_price_usd} USD`);
    }

    return parts.join(" ").trim();
};

const buildListingSourceContext = ({
    subjectCn = "",
    categoryMapped = "",
    sourcePriceCNY = null,
    minOrderQty = null,
    skuProps = "",
    targetMarkets = TARGET_MARKETS_DEFAULT,
} = {}) => ({
    subjectCn: String(subjectCn || "").trim(),
    categoryMapped: String(categoryMapped || "").trim(),
    sourcePriceCNY: sourcePriceCNY != null ? Number(sourcePriceCNY) : null,
    minOrderQty: minOrderQty != null ? Number(minOrderQty) : null,
    skuProps: String(skuProps || "").trim(),
    targetMarkets: String(targetMarkets || TARGET_MARKETS_DEFAULT).trim(),
});

const usdToCny = (usd) => {
    const value = Number(usd);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value * CNY_PER_USD();
};

const buildPriceBandFromUsd = (estimatedPriceUsd, spread = 0.45) => {
    const center = usdToCny(estimatedPriceUsd);
    if (center == null) return null;
    const delta = center * spread;
    return {
        minPrice: Math.max(0, center - delta),
        maxPrice: center + delta,
    };
};

const buildPriceBandFromCny = (priceCny, spread = 0.4) => {
    const center = Number(priceCny);
    if (!Number.isFinite(center) || center <= 0) return null;
    const delta = center * spread;
    return {
        minPrice: Math.max(0, center - delta),
        maxPrice: center + delta,
    };
};

module.exports = {
    TARGET_MARKETS_DEFAULT,
    CNY_PER_USD,
    normalizeBuyerAttributes,
    buildAttributesEmbeddingText,
    buildListingSourceContext,
    usdToCny,
    buildPriceBandFromUsd,
    buildPriceBandFromCny,
};
