import React from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import LoadingContent from "../../Components/Common/LoadingContent";
import CommingSoon from "../Common/CommingSoon";

import ROUTES from "../../helpers/routesHelper";
import { amountConversion, getProductImageUrl, smoothScrollToTop } from "../../helpers/commonHelper";

import placeholder from "../../assets/images/default_name.webp";

const ProductsListingInfinite = ({
  items,
  isLoading,
  message = "",
  hasMore,
  fetchRecords,
}) => {
  const navigate = useNavigate();
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);

  const resolveTrustText = (item) => {
    const moq = item?.moq || item?.minimumOrderQuantity || item?.minOrderQuantity;
    const sold = item?.sold || item?.totalSold || item?.orderCount;
    if (moq && sold) return `MOQ ${moq} • ${sold} sold`;
    if (moq) return `MOQ ${moq}`;
    if (sold) return `${sold} sold`;
    return "";
  };

  const handleOpenProduct = (item) => {
    const fallbackOfferId = item?.offerId || item?.topIds || "";
    const resolvedId = item?._id || item?.id || item?.productId || fallbackOfferId;
    if (!resolvedId) return;
    smoothScrollToTop();
    const params = new URLSearchParams();
    if (fallbackOfferId) params.set("offerId", String(fallbackOfferId));
    params.set("redirectUrl", btoa(window.location.href));
    navigate(
      `${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(String(resolvedId))}?${params.toString()}`
    );
  };

  return (
    <section className="products_card products_listing_square position-relative">
      <InfiniteScroll
        dataLength={items?.length || 0}
        next={fetchRecords}
        hasMore={hasMore}
        loader={(
          <div className="px-0 uza-infinite-scroll">
            <LoadingContent />
          </div>
        )}
        endMessage=""
        className="px-0"
      >
        <div className="new_Arrivals new_Arrivals_many product_square_grid products_infinite_grid">
          {items?.length ? (
            items.map((item, idx) => {
              const resolvedId = String(
                item?._id || item?.id || item?.productId || item?.offerId || item?.topIds || ""
              ).trim();
              const isOut =
                (!item?.manage_stock && item?.stock_status === "outofstock")
                || (item?.manage_stock && Number(item?.stock_quantity) === 0);
              const trust = resolveTrustText(item);

              return (
                <div
                  className="new_arrival_img new_arrival_product_card cursor-pointer text-start"
                  key={item?._id || item?.offerId || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => resolvedId && handleOpenProduct(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (resolvedId) handleOpenProduct(item);
                    }
                  }}
                >
                  <div className="new_arrival_media position-relative">
                    <img
                      src={getProductImageUrl(item, placeholder)}
                      alt={item?.name || "Product"}
                      className="img-fluid"
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
                        <img src="/verified.avif" alt="Verified" className="home_verified_badge" />
                      )}
                      <span className="home_product_cta">View details</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : isLoading ? null : (
            <CommingSoon message={message} />
          )}
        </div>
      </InfiniteScroll>
    </section>
  );
};

export default ProductsListingInfinite;
