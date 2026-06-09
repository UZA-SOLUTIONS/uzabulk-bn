import React from "react";
import { useSelector } from "react-redux";

import {
  amountConversion,
  extractMongoProductId,
  getProductImageUrl,
} from "../../helpers/commonHelper";
import placeholder from "../../assets/images/default_name.webp";
import SupplierVerificationBadge from "./SupplierVerificationBadge";

const resolveTrustText = (item) => {
  const moq = item?.moq || item?.minimumOrderQuantity || item?.minOrderQuantity;
  const sold = item?.sold || item?.totalSold || item?.orderCount || item?.sold_count;
  if (moq && sold) return `MOQ ${moq} • ${sold} sold`;
  if (moq) return `MOQ ${moq}`;
  if (sold) return `${sold} sold`;
  return "";
};

export default function ProductCard({ item, onOpen }) {
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);

  const resolvedId =
    extractMongoProductId(item)
    || String(item?.offerId || item?.topIds || "").trim();
  const isOut =
    (!item?.manage_stock && item?.stock_status === "outofstock")
    || (item?.manage_stock && Number(item?.stock_quantity) === 0);
  const trust = resolveTrustText(item);

  return (
    <div
      className="new_arrival_img new_arrival_product_card cursor-pointer text-start"
      role="button"
      tabIndex={0}
      onClick={() => resolvedId && onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (resolvedId) onOpen?.(item);
        }
      }}
    >
      <div className="new_arrival_media position-relative">
        <img
          src={getProductImageUrl(item, placeholder)}
          alt={item?.name || "Product"}
          className="img-fluid"
          loading="lazy"
        />
        {isOut ? (
          <span className="products_listing_stock_badge">Out of stock</span>
        ) : null}
      </div>
      <div className="home_product_card_body px-1 pt-2">
        <p className="home_product_title mb-1">{item?.name}</p>
        <p className="home_product_price mb-1">
          {currentCurrency?.symbol}{" "}
          {amountConversion(item?.price, appConfig)}
        </p>
        <div className="home_product_footer">
          {trust ? (
            <p className="home_product_meta mb-0">{trust}</p>
          ) : (
            <SupplierVerificationBadge item={item} />
          )}
          <span className="home_product_cta">View details</span>
        </div>
      </div>
    </div>
  );
}
