import moment from "moment";
import DOMPurify from 'dompurify';
import ROUTES from "./routesHelper";
import { apiGet } from "./apiHelper";
import { PRODUCTS } from "./urlHelper";

export const ENVIRONMENT = process.env.REACT_APP_ENVIORNMENT || "production";

const DEVICE_ID_STORE = "uza-retail-device-id";
const COUPON_CODE = "uza-retail-coupon";

export const logger = (...params) => {
  if (ENVIRONMENT === "development")
    console.log(...params);
};

export const smoothScrollToTop = () => {
  document.body.scrollTo({ top: 0, behavior: "smooth" });
};

export const handlePageClick = ({ setSkip = () => { }, fetchRecords = () => { } }) => (event) => {
  setSkip(event.selected + 1);
  fetchRecords(event.selected + 1);
  smoothScrollToTop();
};
export const fromNow = (date) => {
  const now = moment();
  const createdAtMoment = moment(date);
  const fromNow = now.diff(createdAtMoment, "days");

  return fromNow - (fromNow % 10) + 10;
};

export const isEqualArray = (arr1, arr2) => {
  arr1.sort();
  arr2.sort();
  return JSON.stringify(arr1) === JSON.stringify(arr2);
};

export const fixedNumber = (number, toFix = 2) => {
  return Number(parseFloat(number).toFixed(toFix));
};

export const formatNumber = (number, toFix = 2, isString = false) => {
  return fixedNumber(number, toFix, isString).toLocaleString('en-US');
};

export const scrollToId = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

// Generate a unique identifier (UUID)
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

export const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_STORE);
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_STORE, deviceId);
  }

  return deviceId;
}

const HOME_FEED_REFRESH_KEY = "uza-home-feed-refresh";

/** New token each home visit so rotated product pools change. */
export const bumpHomeFeedRefreshToken = () => {
  const token = String(Date.now());
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(HOME_FEED_REFRESH_KEY, token);
  }
  return token;
};

export const getHomeFeedRefreshToken = () => {
  if (typeof sessionStorage === "undefined") {
    return String(Date.now());
  }
  return sessionStorage.getItem(HOME_FEED_REFRESH_KEY) || bumpHomeFeedRefreshToken();
};

/** Stable key for deduplicating catalog rows (_id, id, productId, offerId). */
export const getProductDedupeKey = (item) => {
  const id = String(item?._id || item?.id || item?.productId || "").trim();
  if (id) return `id:${id}`;
  const offer = String(item?.offerId || item?.topIds || "").trim();
  if (offer) return `offer:${offer}`;
  return "";
};

export const isValidHomeCatalogProduct = (item) => {
  if (!item) return false;
  if (!getProductDedupeKey(item)) return false;
  const name = (item?.name || "").trim();
  if (!name || name.toLowerCase().includes("test")) return false;
  return true;
};

export const dedupeProducts = (items = []) => {
  const seen = new Set();
  const unique = [];
  (items || []).forEach((item) => {
    const key = getProductDedupeKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  return unique;
};

export const mergeUniqueProducts = (existing = [], incoming = []) => {
  const seen = new Set((existing || []).map(getProductDedupeKey).filter(Boolean));
  const merged = [...(existing || [])];
  (incoming || []).forEach((item) => {
    const key = getProductDedupeKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged;
};

export const normalizeHomeCatalogProducts = (items = [], { excludeKeys = null } = {}) => {
  const exclude = excludeKeys instanceof Set ? excludeKeys : null;
  return dedupeProducts(items).filter((item) => {
    if (!isValidHomeCatalogProduct(item)) return false;
    if (!exclude?.size) return true;
    const key = getProductDedupeKey(item);
    return key && !exclude.has(key);
  });
};


export const setCoupon = (coupon = "") => {
  localStorage.setItem(COUPON_CODE, coupon);
}


export const getCoupon = () => {
  return localStorage.getItem(COUPON_CODE) || "";
}

export const parseText = (text) => {
  const formattedDescription = (text || "").replace(/(?:\\r\n|\\r|\\n)/g, ' ');

  return DOMPurify.sanitize(formattedDescription);
}

/** Browser-only; safe when this module is evaluated in Node during tests. */
function getBrowserLocation() {
  if (typeof window === "undefined") return null;
  return window.location;
}

const getMediaOrigin = () => {
  const api = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
  if (api) return api;
  const loc = getBrowserLocation();
  if (loc?.origin) {
    return loc.origin.replace(/\/+$/, "");
  }
  return "";
};

/**
 * Turn API image fields (absolute URL, "/path", or "uploads/…") into a usable <img src>.
 */
export const resolveMediaUrl = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    return resolveMediaUrl(
      value.link || value.url || value.src || value.path || ""
    );
  }
  const raw = String(value).trim();
  if (!raw) return "";
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "");
  if (!unquoted) return "";
  if (/^(https?:|data:|blob:)/i.test(unquoted)) return unquoted;
  if (unquoted.startsWith("//")) {
    const loc = getBrowserLocation();
    if (loc?.protocol) {
      return `${loc.protocol}${unquoted}`;
    }
    return `https:${unquoted}`;
  }
  const origin = getMediaOrigin();
  if (!origin) return unquoted.startsWith("/") ? unquoted : "";
  if (unquoted.startsWith("/")) return `${origin}${unquoted}`;
  return `${origin}/${unquoted.replace(/^\/+/, "")}`;
};

export const getUserAvatarUrl = (user) => {
  if (!user) return "";
  return resolveMediaUrl(user.profileImage);
};

export const getUserInitials = (user) => {
  const name = String(user?.name || user?.hintName || user?.email || "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

/** MongoDB ObjectId string (24 hex). */
export const looksLikeMongoProductId = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

/** 1688 numeric offer id (not a Mongo ObjectId). */
export const looksLike1688OfferId = (value) => {
  const s = String(value || "").trim();
  if (!/^\d+$/.test(s) || s.length < 4 || s.length > 30) return false;
  if (s.length === 24 && /^[a-fA-F0-9]{24}$/.test(s)) return false;
  return true;
};

export const extractMongoProductId = (item) => {
  const raw = item?._id ?? item?.id ?? item?.productId;
  if (raw && typeof raw === "object" && raw.$oid) {
    return String(raw.$oid).trim();
  }
  return String(raw || "").trim();
};

/** Resolve canonical Mongo _id (via by-offer when needed). */
export const resolveCatalogProductId = async (item) => {
  const offerId = String(item?.offerId || item?.topIds || "").trim();
  const mongoId = extractMongoProductId(item);

  if (looksLike1688OfferId(offerId)) {
    try {
      const res = await apiGet(`${PRODUCTS.BY_OFFER}/${encodeURIComponent(offerId)}`, {
        suppressGlobalErrorToast: true,
      });
      const resolved = String(res?.data?._id || "").trim();
      if (looksLikeMongoProductId(resolved)) {
        return { mongoId: resolved, offerId };
      }
    } catch {
      // fall through
    }
  }

  if (looksLikeMongoProductId(mongoId)) {
    return { mongoId, offerId: offerId || undefined };
  }

  if (looksLike1688OfferId(mongoId)) {
    try {
      const res = await apiGet(`${PRODUCTS.BY_OFFER}/${encodeURIComponent(mongoId)}`, {
        suppressGlobalErrorToast: true,
      });
      const resolved = String(res?.data?._id || "").trim();
      if (looksLikeMongoProductId(resolved)) {
        return { mongoId: resolved, offerId: mongoId };
      }
    } catch {
      // fall through
    }
  }

  return null;
};

/** Product detail URL: prefers catalog _id; always passes offerId when known. */
export const buildProductDetailUrl = (item, options = {}) => {
  const offerId = String(item?.offerId || item?.topIds || "").trim();
  const mongoId = extractMongoProductId(item);
  let pathId = "";

  if (looksLikeMongoProductId(mongoId)) {
    pathId = mongoId;
  } else if (looksLike1688OfferId(offerId)) {
    pathId = offerId;
  } else if (looksLike1688OfferId(mongoId)) {
    pathId = mongoId;
  } else {
    pathId = mongoId || offerId;
  }

  if (!pathId) return null;

  const params = new URLSearchParams();
  if (offerId) {
    params.set("offerId", offerId);
  }
  if (options.redirectUrl) {
    params.set("redirectUrl", options.redirectUrl);
  }
  const qs = params.toString();
  return `${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(pathId)}${qs ? `?${qs}` : ""}`;
};

export const buildProductDetailUrlFromResolved = ({ mongoId, offerId } = {}, options = {}) => {
  if (!looksLikeMongoProductId(mongoId)) return null;
  const params = new URLSearchParams();
  if (offerId) params.set("offerId", String(offerId));
  if (options.redirectUrl) params.set("redirectUrl", options.redirectUrl);
  const qs = params.toString();
  return `${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(mongoId)}${qs ? `?${qs}` : ""}`;
};

export const getProductImageUrl = (product, fallback = "") => {
  const candidates = [];
  if (product?.featured_image != null) candidates.push(product.featured_image);
  if (Array.isArray(product?.images)) {
    candidates.push(...product.images);
  }
  for (const c of candidates) {
    const u = resolveMediaUrl(c);
    if (u) return u;
  }
  return resolveMediaUrl(fallback);
};

export const amountConversion = (amount, config, toFix = 2, isString = false) => {
  let finalAmount = amount;

  // If commission is present in config, adjust the amount accordingly (uncomment if needed)
  // const commission = config?.commission?.per_product || 0;
  // finalAmount = finalAmount + ((commission * finalAmount) / 100);

  // Get the fixed number for the amount, ensuring a non-zero value for very small numbers
  const fixedValue = fixedNumber(finalAmount, toFix, isString);

  // If isString is true, fixedNumber already returns a string, so no need for further formatting
  if (isString) return fixedValue;

  // Convert the fixed amount to a localized string
  return fixedValue.toLocaleString('en-US');
};