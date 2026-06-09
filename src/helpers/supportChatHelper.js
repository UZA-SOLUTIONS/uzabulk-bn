import ROUTES from "./routesHelper";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "../config/constants";

/** Local Rwanda numbers (078…) → 250… for wa.me */
const normalizeWhatsappNumber = (raw) => {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `250${digits.slice(1)}`;
  }
  return digits;
};

const getProductPageUrl = (detail) => {
  if (typeof window === "undefined") return "";
  const path = detail?._id
    ? `${ROUTES.PRODUCT_DETAIL}/${detail._id}`
    : window.location.pathname;
  return `${window.location.origin}${path}`;
};

export const buildProductChatMessage = (detail = {}) => {
  const lines = [
    "Hi, I have a question about this product:",
    detail?.name || "Product",
    detail?.offerId ? `Offer ID: ${detail.offerId}` : null,
    detail?.supplier_id || detail?.sellerOpenId
      ? `Supplier ID: ${detail.supplier_id || detail.sellerOpenId}`
      : null,
    `Link: ${getProductPageUrl(detail)}`,
  ].filter(Boolean);
  return lines.join("\n");
};

/**
 * Opens support chat for a product: WhatsApp (if configured) → email → contact page.
 */
export const openProductSupportChat = ({ detail, navigate }) => {
  const message = buildProductChatMessage(detail);
  const encodedMessage = encodeURIComponent(message);
  const whatsappDigits = normalizeWhatsappNumber(
    SUPPORT_WHATSAPP || process.env.REACT_APP_SUPPORT_WHATSAPP || ""
  );

  if (whatsappDigits) {
    window.open(
      `https://wa.me/${whatsappDigits}?text=${encodedMessage}`,
      "_blank",
      "noopener,noreferrer"
    );
    return;
  }

  const email = String(SUPPORT_EMAIL || process.env.REACT_APP_SUPPORT_EMAIL || "").trim();
  if (email) {
    const subject = encodeURIComponent(
      `Product inquiry: ${detail?.name || "UZA Store"}`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${encodedMessage}`;
    return;
  }

  if (typeof navigate === "function") {
    navigate(ROUTES.CONTACT_US, {
      state: {
        productInquiry: message,
        productName: detail?.name || "",
      },
    });
    return;
  }

  window.location.assign(ROUTES.CONTACT_US);
};
