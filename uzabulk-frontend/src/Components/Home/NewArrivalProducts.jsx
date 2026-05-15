import React, { useEffect, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { amountConversion, getProductImageUrl, logger } from "../../helpers/commonHelper";
import { apiGetHomeNewArrivalProducts } from "../../store/products/actions";

import placeholder from "../../assets/images/default_name.webp";
import UXSkeleton from "../Common/UXSkeleton";

function newArrivalsSkeletonSlotCount(viewportWidth) {
  const w = viewportWidth || 1200;
  /* Match CSS clamp(158px, 38vw, 204px) used for cards (same as Source by category) */
  const card = Math.min(204, Math.max(158, w * 0.38));
  const gap = 14;
  const visible = Math.ceil(w / (card + gap));
  return Math.min(36, Math.max(6, visible + 6));
}

function productDetailPath(item) {
  const fallbackOfferId = item?.offerId || item?.topIds || "";
  const resolvedId = item?._id || item?.id || item?.productId || fallbackOfferId;
  if (!resolvedId) return ROUTES.PRODUCT_LISTING;
  const offerQuery = fallbackOfferId ? `?offerId=${encodeURIComponent(fallbackOfferId)}` : "";
  return `${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(resolvedId)}${offerQuery}`;
}

function resolveTrustLine(item) {
  const moq = item?.moq || item?.minimumOrderQuantity || item?.minOrderQuantity;
  const sold = item?.sold || item?.totalSold || item?.orderCount;
  if (moq && sold) return `MOQ ${moq} • ${sold} sold`;
  if (moq) return `MOQ ${moq}`;
  if (sold) return `${sold} sold`;
  return "";
}

export default function NewArrivalProducts() {
  const dispatch = useDispatch();
  const [skeletonSlots, setSkeletonSlots] = useState(() =>
    typeof window !== "undefined" ? newArrivalsSkeletonSlotCount(window.innerWidth) : 16
  );
  const { isLoading, items } = useSelector((s) => s.products.homeNewArrivalProducts);
  const { items: recommendedItems } = useSelector((s) => s.products.homeRecommendedProducts);
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);
  logger("NEW ARRIVAL PRODUCT SLIDER", items);
  const limit = 100;

  const filteredItems = (items || []).filter((item) => {
    const name = (item?.name || "").toLowerCase().trim();
    return name && !name.includes("test");
  });
  const filteredRecommended = (recommendedItems || []).filter((item) => {
    const name = (item?.name || "").toLowerCase().trim();
    return name && !name.includes("test");
  });
  const displayItems = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...filteredRecommended, ...filteredItems].forEach((item) => {
      const key = item?._id || item?.id || item?.productId || item?.offerId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
    return merged;
  }, [filteredRecommended, filteredItems]);

  useEffect(() => {
    const onResize = () => setSkeletonSlots(newArrivalsSkeletonSlotCount(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!items?.length)
      dispatch(
        apiGetHomeNewArrivalProducts({
          limit,
        })
      );
  }, [dispatch, items?.length, limit]);

  const LoadingFallback = () => (
    <div className="home_feed_section_offset px-3 w-100">
      <section className="home_new_arrivals_panel" aria-busy="true">
        <div className="home_new_arrivals_panel__head">
          <h2 className="home_new_arrivals_panel__title">New Arrivals</h2>
          <span className="home_new_arrivals_panel__view_placeholder" />
        </div>
        <div className="home_new_arrivals_panel__skeleton">
          <UXSkeleton count={skeletonSlots} />
        </div>
      </section>
    </div>
  );

  if (isLoading) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoadingFallback />
      </Suspense>
    );
  }

  if (!displayItems.length) {
    return null;
  }

  return (
    <div className="home_feed_section_offset px-3 w-100">
      <section className="home_new_arrivals_panel" aria-labelledby="home-new-arrivals-title">
        <div className="home_new_arrivals_panel__head">
          <h2 id="home-new-arrivals-title" className="home_new_arrivals_panel__title">
            New Arrivals
          </h2>
          <Link to={ROUTES.NEW_ARRIVALS_PRODUCT_LISTING} className="home_new_arrivals_panel__view_all">
            View All <span aria-hidden>&gt;</span>
          </Link>
        </div>

        <div className="home_new_arrivals_row">
          {displayItems.map((item, idx) => {
            const trust = resolveTrustLine(item);
            return (
              <Link
                key={item?._id || item?.id || idx}
                to={productDetailPath(item)}
                className="new_arrival_img new_arrival_product_card text-start text-decoration-none d-block text-reset"
              >
                <div className="new_arrival_media">
                  <img
                    src={getProductImageUrl(item, placeholder)}
                    alt={item?.name || "Product"}
                    className="img-fluid"
                  />
                </div>
                <div className="home_product_card_body px-1 pt-2">
                  <p className="home_product_title mb-1">{item?.name}</p>
                  <p className="home_product_price mb-1">
                    {currentCurrency?.symbol} {amountConversion(item?.price, appConfig)}
                  </p>
                  <div className="home_product_footer">
                    {trust ? (
                      <p className="home_product_meta mb-0">{trust}</p>
                    ) : (
                      <>
                        <img src="/verified.avif" alt="Verified" className="home_verified_badge" />
                        <span className="home_product_cta">View details</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
