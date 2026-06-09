/** In-memory cache for home category thumbnails (keyed per feed refresh). */
const cache = Object.create(null);

function cacheKey(categoryId, refresh = "") {
  return `${String(categoryId || "").trim()}:${refresh || "0"}`;
}

export function getHomeCategoryCircleImage(categoryId, refresh = "") {
  const id = String(categoryId || "").trim();
  if (!id) return "";
  return cache[cacheKey(id, refresh)] || "";
}

export function setHomeCategoryCircleImage(categoryId, url, refresh = "") {
  const id = String(categoryId || "").trim();
  if (id && url) cache[cacheKey(id, refresh)] = url;
}

export function clearHomeCategoryCircleImage(categoryId, refresh = "") {
  const id = String(categoryId || "").trim();
  if (id) delete cache[cacheKey(id, refresh)];
}

export function clearHomeCategoryCircleImageCache() {
  Object.keys(cache).forEach((key) => {
    delete cache[key];
  });
}
