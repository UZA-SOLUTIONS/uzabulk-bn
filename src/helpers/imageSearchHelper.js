import apiClient from "./apiHelper";
import { PRODUCTS } from "./urlHelper";

/**
 * Upload an image and run AI vision catalog search in one request.
 */
export const uploadImageSearch = async (file, { limit = 32 } = {}) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiClient.post(PRODUCTS.IMAGE_SEARCH, formData, {
    params: { limit, skip: 1 },
    headers: { "Content-Type": "multipart/form-data" },
    suppressGlobalErrorToast: true,
  });

  if (res?.status !== "success") {
    throw new Error(res?.message || "Image search failed");
  }

  return res.data || {};
};
