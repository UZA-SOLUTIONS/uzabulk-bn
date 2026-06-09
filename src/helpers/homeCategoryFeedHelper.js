import { apiGet } from "./apiHelper";
import { getProductImageUrl, resolveMediaUrl } from "./commonHelper";
import { PRODUCTS } from "./urlHelper";

/** Category icon from API (populated file, plain URL, or legacy shapes). */
export function resolveCategoryIconUrl(category) {
  const catImage = category?.catImage;
  if (!catImage) return "";
  if (typeof catImage === "string") return resolveMediaUrl(catImage);
  return resolveMediaUrl(catImage?.link || catImage?.url || catImage?.src || "");
}

/** Stable numeric hash for home feed rotation keys. */
export function hashHomeFeedKey(key = "") {
  let hash = 0;
  const str = String(key);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Pick a different slice of categories on each home visit. */
export function getCategoryDisplayName(category) {
  return (category?.catName || category?.name || category?.title || "").trim();
}

export function rotateHomeCategories(categories = [], refresh = "", max = 16) {
  const list = (categories || []).filter((c) => c?._id && getCategoryDisplayName(c));
  if (!list.length) return [];
  const token = refresh || "0";
  return [...list]
    .sort((a, b) => {
      const ha = hashHomeFeedKey(`${a._id}:${token}:cat`);
      const hb = hashHomeFeedKey(`${b._id}:${token}:cat`);
      return ha - hb;
    })
    .slice(0, max);
}

/** Offset into a category's product list for a representative thumbnail (1-based page). */
export function getCategoryRepresentativeSkip(categoryId, refresh = "", poolSize = 8) {
  if (!categoryId) return 1;
  const token = refresh || "0";
  return (hashHomeFeedKey(`${categoryId}:${token}:img`) % poolSize) + 1;
}

async function fetchListThumbnail(category, skip) {
  const res = await apiGet(PRODUCTS.LIST, {
    category: String(category._id),
    limit: 1,
    skip,
    suppressGlobalErrorToast: true,
  });
  if (res?.status !== "success") return "";
  const product = res?.data?.items?.[0];
  const url = getProductImageUrl(product, "");
  return resolveMediaUrl(url);
}

/** One request for many category preview images (home "Source by category"). */
export async function fetchCategoryThumbnailsBatch(categories = [], feedRefresh = "") {
  const ids = categories.map((c) => String(c?._id || "").trim()).filter(Boolean);
  if (!ids.length) return {};

  try {
    const res = await apiGet(PRODUCTS.CATEGORY_THUMBNAILS, {
      ids: ids.join(","),
      refresh: feedRefresh || "",
      suppressGlobalErrorToast: true,
    });
    if (res?.status === "success" && res?.data && typeof res.data === "object") {
      const normalized = {};
      Object.entries(res.data).forEach(([id, url]) => {
        const key = String(id || "").trim();
        const resolved = resolveMediaUrl(url);
        if (key && resolved) normalized[key] = resolved;
      });
      return normalized;
    }
  } catch {
    /* fall through to per-category */
  }
  return {};
}

/** Rotating product thumbnail for a category (changes per home visit via feedRefresh). */
export async function fetchCategoryProductThumbnail(category, feedRefresh, poolSize = 12) {
  if (!category?._id) return "";

  const primary = getCategoryRepresentativeSkip(category._id, feedRefresh, poolSize);
  const candidates = [...new Set([
    primary,
    ...Array.from({ length: Math.min(poolSize, 8) }, (_, i) => i + 1),
  ])];

  for (let i = 0; i < candidates.length; i += 1) {
    try {
      const url = await fetchListThumbnail(category, candidates[i]);
      if (url) return url;
    } catch {
      /* try next page */
    }
  }
  return "";
}

/** Product thumbnail, then category icon (used by category circles). */
export async function fetchCategoryRepresentativeImage(category, feedRefresh) {
  const productUrl = await fetchCategoryProductThumbnail(category, feedRefresh, 8);
  if (productUrl) return productUrl;
  return resolveCategoryIconUrl(category);
}
