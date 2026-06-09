// src/apiHelper.js
import axios from "axios";
import { toast } from "react-toastify";
import { getAuthToken, removeAuthInfo } from "./authHelper";
import ROUTES from "./routesHelper";
import { getDeviceId, logger } from "./commonHelper";
import { getCurrencySymbol } from "./currencyHelper";

const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:1302").replace(/\/+$/, "");

/**
 * Axios request timeout (ms). Default 0 = no client timeout (avoids "timeout of 120000ms exceeded").
 * Set REACT_APP_API_TIMEOUT_MS to cap wait time (min 5s when > 0, max 5m).
 */
const resolveApiTimeoutMs = () => {
  const raw = process.env.REACT_APP_API_TIMEOUT_MS;
  if (raw === "" || raw === undefined || raw === null) {
    return 0;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(Math.max(parsed, 5000), 300_000);
};

// Create an instance of axios with default settings
const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: resolveApiTimeoutMs(),
  headers: {
    "Content-Type": "application/json",
    "DeviceId": getDeviceId(),
  },
});
let requestInterceptorId = null;

// Response interceptor (for handling responses and errors globally)
apiClient.interceptors.response.use(
  (response) => response.data || null,
  (error) => {
    const suppressGlobalErrorToast = !!error?.config?.suppressGlobalErrorToast;
    const isCanceledRequest = axios.isCancel(error)
      || error?.code === "ERR_CANCELED"
      || error?.name === "CanceledError"
      || error?.name === "AbortError";
    if (isCanceledRequest) {
      return Promise.reject(error);
    }

    const isNetworkError = !error?.response;

    const message = error?.response?.data?.message
      || error?.message
      || "Something went wrong, please try again later.";

    // Do not show a global toast for network/timeout/offline failures — callers can handle UX; avoids noisy "check backend" toasts.
    if (!suppressGlobalErrorToast && !isNetworkError) {
      toast.error(message);
    }

    logger("ERROR RESPONSE ::: ", error);
    // Handle response errors
    if (error.response && error.response.status === 401) {
      const reqUrl = `${error?.config?.baseURL || ""}${error?.config?.url || ""}`;
      const isAuthRoute =
        /users\/login\b/i.test(reqUrl)
        || /users\/register\b/i.test(reqUrl)
        || /users\/verify/i.test(reqUrl)
        || /users\/forgotPassword/i.test(reqUrl)
        || /users\/resetPassword/i.test(reqUrl);
      if (isAuthRoute) {
        return Promise.reject(error?.response?.data || error);
      }
      const hasToken = !!getAuthToken();
      if (hasToken) {
        removeAuthInfo();
        window.location.href = `${ROUTES.HOME}?auth=signin`;
      }
    }
    return Promise.reject(error?.response?.data || error);
  }
);

export const updateAuthToken = () => {
  // Keep exactly one request interceptor to avoid stacking duplicates.
  if (requestInterceptorId !== null) {
    apiClient.interceptors.request.eject(requestInterceptorId);
  }

  requestInterceptorId = apiClient.interceptors.request.use(
    (config) => {
      // Modify the request config before sending the request
      const token = getAuthToken(); // Example: Get token from localStorage
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      config.headers["Accept-Currency"] = getCurrencySymbol(); // Set the custom header for currency
      if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }
      return config;
    },
    (error) => {
      // Handle request errors
      return Promise.reject(error);
    }
  );
};
updateAuthToken();

// Basic functions for making API calls
export const apiGet = async (url, params = {}) => {
  const { suppressGlobalErrorToast, signal, ...query } = params || {};
  return apiClient.get(url, {
    params: query,
    ...(signal ? { signal } : {}),
    ...(suppressGlobalErrorToast ? { suppressGlobalErrorToast: true } : {}),
  });
};

export const apiPost = async (url, data = {}) => {
  return apiClient.post(url, data);
};

export const apiPut = async (url, data = {}) => {
  return apiClient.put(url, data);
};

export const apiDelete = async (url) => {
  return apiClient.delete(url);
};

// Export the apiClient if you need to use it directly for advanced use cases
export default apiClient;
