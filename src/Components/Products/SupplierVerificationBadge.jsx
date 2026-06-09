import React from "react";

const badgeLabel = (item) => {
  const verification = item?.supplier_verification || item?.supplierVerification;
  if (!verification) return null;

  if (verification.display_badge) {
    return String(verification.display_badge);
  }

  const status = String(verification.verification_status || "").toUpperCase();
  const score = verification.trust_score;

  if (status === "VERIFIED" && score != null) {
    return `Verified supplier · ${Math.round(Number(score))}%`;
  }
  if (status === "VERIFIED") return "Verified supplier";
  if (status === "FLAGGED") return "Review supplier";
  return null;
};

export default function SupplierVerificationBadge({ item, className = "" }) {
  const label = badgeLabel(item);

  if (label) {
    return (
      <span className={`home_product_meta supplier_verification_badge mb-0 ${className}`.trim()}>
        {label}
      </span>
    );
  }

  return (
    <img
      src="/verified.avif"
      alt="Verified"
      className={`home_verified_badge ${className}`.trim()}
    />
  );
}
