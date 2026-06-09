import React, { useCallback, useEffect, useRef } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useNavigate } from "react-router-dom";

import LoadingContent from "../../Components/Common/LoadingContent";
import CommingSoon from "../Common/CommingSoon";
import ProductCard from "./ProductCard";

import {
  buildProductDetailUrl,
  buildProductDetailUrlFromResolved,
  resolveCatalogProductId,
  smoothScrollToTop,
} from "../../helpers/commonHelper";

const ProductsListingInfinite = ({
  items,
  isLoading,
  message = "",
  hasMore,
  fetchRecords,
  gridClassName = "",
}) => {
  const navigate = useNavigate();
  const lastAutoFetchAtRef = useRef(0);

  const handleOpenProduct = useCallback(async (item) => {
    smoothScrollToTop();
    const resolved = await resolveCatalogProductId(item);
    const path = resolved
      ? buildProductDetailUrlFromResolved(resolved, {
          redirectUrl: btoa(window.location.href),
        })
      : buildProductDetailUrl(item, {
          redirectUrl: btoa(window.location.href),
        });
    if (!path) return;
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    if (!hasMore || isLoading || typeof fetchRecords !== "function") {
      return;
    }
    const fillShortPage = () => {
      const docHeight = document.documentElement.scrollHeight;
      const viewHeight = window.innerHeight;
      const needsMore = !items?.length || items.length < 24;
      const now = Date.now();
      if ((needsMore || docHeight <= viewHeight + 120) && now - lastAutoFetchAtRef.current > 650) {
        lastAutoFetchAtRef.current = now;
        fetchRecords();
      }
    };
    fillShortPage();
    window.addEventListener("resize", fillShortPage);
    return () => window.removeEventListener("resize", fillShortPage);
  }, [items?.length, hasMore, isLoading, fetchRecords]);

  return (
    <section className="products_card products_listing_square position-relative">
      <InfiniteScroll
        dataLength={items?.length || 0}
        next={() => fetchRecords?.()}
        hasMore={Boolean(hasMore)}
        scrollThreshold={0.85}
        loader={(
          <div className="px-0 uza-infinite-scroll">
            <LoadingContent />
          </div>
        )}
        endMessage=""
        className="px-0"
      >
        <div
          className={`new_Arrivals new_Arrivals_many product_square_grid products_infinite_grid${gridClassName ? ` ${gridClassName}` : ""}`}
        >
          {items?.length ? (
            items.map((item, idx) => (
              <ProductCard
                key={item?._id || item?.offerId || idx}
                item={item}
                onOpen={handleOpenProduct}
              />
            ))
          ) : isLoading ? null : (
            <CommingSoon message={message} />
          )}
        </div>
      </InfiniteScroll>
    </section>
  );
};

export default ProductsListingInfinite;
