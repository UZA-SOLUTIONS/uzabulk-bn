import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import {
  amountConversion,
  buildProductDetailUrl,
  buildProductDetailUrlFromResolved,
  getProductImageUrl,
  getHomeFeedRefreshToken,
  resolveCatalogProductId,
} from "../../helpers/commonHelper";
import { apiGetHomeNewArrivalProducts } from "../../store/products/actions";

import placeholder from "../../assets/images/default_name.webp";
import UXSkeleton from "../Common/UXSkeleton";
import SupplierVerificationBadge from "../Products/SupplierVerificationBadge";

function newArrivalsSkeletonSlotCount(viewportWidth) {
  const w = viewportWidth || 1200;
  const card = Math.min(204, Math.max(158, w * 0.38));
  const gap = 14;
  const visible = Math.ceil(w / (card + gap));
  return Math.min(24, Math.max(6, visible + 2));
}

function resolveTrustLine(item) {
  const moq = item?.moq || item?.minimumOrderQuantity || item?.minOrderQuantity;
  const sold = item?.sold || item?.totalSold || item?.orderCount;
  if (moq && sold) return `MOQ ${moq} • ${sold} sold`;
  if (moq) return `MOQ ${moq}`;
  if (sold) return `${sold} sold`;
  return "";
}

const isTestProduct = (item) => {
  const name = (item?.name || "").toLowerCase().trim();
  return !name || name.includes("test");
};

export default function NewArrivalProducts() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [skeletonSlots, setSkeletonSlots] = useState(() =>
    typeof window !== "undefined" ? newArrivalsSkeletonSlotCount(window.innerWidth) : 12
  );
  const [feedRefresh, setFeedRefresh] = useState(() => getHomeFeedRefreshToken());
  const { isLoading, items } = useSelector((s) => s.products.homeNewArrivalProducts);
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);

  const fetchLimit = useMemo(
    () => Math.min(24, Math.max(12, skeletonSlots)),
    [skeletonSlots]
  );

  const displayItems = useMemo(
    () => (items || []).filter((item) => !isTestProduct(item)).slice(0, fetchLimit),
    [items, fetchLimit]
  );

  useEffect(() => {
    const onResize = () => setSkeletonSlots(newArrivalsSkeletonSlotCount(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setFeedRefresh(getHomeFeedRefreshToken());
  }, []);

  useEffect(() => {
    dispatch(
      apiGetHomeNewArrivalProducts({
        limit: fetchLimit,
        refresh: feedRefresh,
        suppressGlobalErrorToast: true,
      })
    );
  }, [dispatch, fetchLimit, feedRefresh]);

  const showRowSkeleton = isLoading && !displayItems.length;
  const showEmpty = !isLoading && !displayItems.length;

  if (showEmpty) {
    return null;
  }

  return (
    <div className="home_feed_section_offset px-3 w-100">
      <section
        className="home_new_arrivals_panel"
        aria-labelledby="home-new-arrivals-title"
        aria-busy={showRowSkeleton}
      >
        <div className="home_new_arrivals_panel__head">
          <h2 id="home-new-arrivals-title" className="home_new_arrivals_panel__title">
            New Arrivals
          </h2>
          <Link to={ROUTES.NEW_ARRIVALS_PRODUCT_LISTING} className="home_new_arrivals_panel__view_all">
            View All <span aria-hidden>&gt;</span>
          </Link>
        </div>

        {showRowSkeleton ? (
          <div className="home_new_arrivals_panel__skeleton">
            <UXSkeleton count={skeletonSlots} />
          </div>
        ) : (
          <div className="home_new_arrivals_row">
            {displayItems.map((item, idx) => {
              const trust = resolveTrustLine(item);
              return (
                <Link
                  key={item?._id || item?.id || idx}
                  to={ROUTES.PRODUCT_LISTING}
                  className="new_arrival_img new_arrival_product_card text-start text-decoration-none d-block text-reset"
                  onClick={async (e) => {
                    e.preventDefault();
                    const resolved = await resolveCatalogProductId(item);
                    const path = resolved
                      ? buildProductDetailUrlFromResolved(resolved)
                      : buildProductDetailUrl(item);
                    if (path) navigate(path);
                  }}
                >
                  <div className="new_arrival_media">
                    <img
                      src={getProductImageUrl(item, placeholder)}
                      alt={item?.name || "Product"}
                      className="img-fluid"
                      loading="lazy"
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
                        <SupplierVerificationBadge item={item} />
                      )}
                      <span className="home_product_cta">View details</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
