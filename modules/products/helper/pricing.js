/**
 * Shared product pricing helpers for 1688 sync + API display fallbacks.
 * Prefer real catalog prices (tiers / SKUs). Do not use AI suggestions.
 */

const toPositivePrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  // Nested shapes from some 1688 payloads: { price: "1.2" } already unwrapped by caller.
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const rangeStartQty = (range = {}) =>
  Number(
    range.startQuantity
      ?? range.minQuantity
      ?? range.beginAmount
      ?? range.quantity
      ?? range.qty
  ) || 0;

const rangePrice = (range = {}) =>
  toPositivePrice(
    range.price
      ?? range.priceValue
      ?? range.consignPrice
      ?? range.salePrice
      ?? range.offerPrice
  );

/**
 * Coalesce the first non-empty price-range array from 1688 field aliases.
 */
const pickRawPriceRangeList = (...candidates) => {
  for (const list of candidates) {
    if (Array.isArray(list) && list.length) return list;
  }
  return [];
};

/**
 * Normalize raw 1688 priceRangeList / priceRanges rows.
 */
const normalizePriceRangeList = (rawList = []) => {
  if (!Array.isArray(rawList) || !rawList.length) return [];

  return rawList
    .map((range) => {
      if (!range || typeof range !== "object") return null;
      const startQuantity = rangeStartQty(range);
      const price = rangePrice(range);
      return {
        ...range,
        startQuantity: startQuantity || range.startQuantity || range.minQuantity,
        minQuantity: range.minQuantity ?? (startQuantity || undefined),
        maxQuantity: range.maxQuantity ?? range.endQuantity,
        // Keep numeric price when available; leave original if not coercible.
        ...(price != null ? { price } : {}),
      };
    })
    .filter(Boolean);
};

/**
 * Build stored price_tiers from a normalized range list (sorted by qty).
 */
const transformPriceRange = (priceRangeList = []) => {
  const list = normalizePriceRangeList(priceRangeList);
  if (!list.length) return [];

  return [...list]
    .sort((a, b) => rangeStartQty(a) - rangeStartQty(b))
    .map((range) => ({
      minQty: range.minQuantity ?? range.startQuantity,
      maxQty: range.maxQuantity,
      price: rangePrice(range) ?? (Number(range.price) || 0),
      startQuantity: range.startQuantity ?? range.minQuantity,
    }));
};

const resolveFirstTierPrice = (priceTiers = []) => {
  const sorted = [...(priceTiers || [])].sort(
    (a, b) => rangeStartQty(a) - rangeStartQty(b)
  );
  for (const tier of sorted) {
    const p = toPositivePrice(tier?.price);
    if (p != null) return p;
  }
  return null;
};

const resolveMinTierPrice = (priceTiers = []) => {
  let min = null;
  for (const tier of priceTiers || []) {
    const p = toPositivePrice(tier?.price);
    if (p == null) continue;
    if (min == null || p < min) min = p;
  }
  return min;
};

const resolveMinSkuPrice = (skuInfos = []) => {
  let min = null;
  for (const sku of skuInfos || []) {
    const p = toPositivePrice(
      sku?.consignPrice ?? sku?.price ?? sku?.salePrice ?? sku?.offerPrice
    );
    if (p == null) continue;
    if (min == null || p < min) min = p;
  }
  return min;
};

/**
 * Resolve the catalog list/detail unit price.
 * Order: existing positive price → MOQ tier (lowest qty) → min SKU/variation.
 */
const resolveProductListPrice = ({
  price,
  price_tiers,
  productSkuInfos,
  variations,
} = {}) => {
  const existing = toPositivePrice(price);
  if (existing != null) return existing;

  const fromTiers =
    resolveFirstTierPrice(price_tiers) ?? resolveMinTierPrice(price_tiers);
  if (fromTiers != null) return fromTiers;

  const fromSkus = resolveMinSkuPrice(productSkuInfos);
  if (fromSkus != null) return fromSkus;

  const fromVariations = resolveMinSkuPrice(variations);
  if (fromVariations != null) return fromVariations;

  return 0;
};

/**
 * Fill item.price from tiers/variations when stored price is missing/zero (API read path).
 */
const attachFallbackProductPrice = (item) => {
  if (!item || typeof item !== "object") return item;
  const resolved = resolveProductListPrice({
    price: item.price,
    price_tiers: item.price_tiers,
    variations: item.variations,
  });
  if (resolved > 0) {
    item.price = resolved;
  }
  return item;
};

module.exports = {
  toPositivePrice,
  pickRawPriceRangeList,
  normalizePriceRangeList,
  transformPriceRange,
  resolveFirstTierPrice,
  resolveMinTierPrice,
  resolveMinSkuPrice,
  resolveProductListPrice,
  attachFallbackProductPrice,
};
