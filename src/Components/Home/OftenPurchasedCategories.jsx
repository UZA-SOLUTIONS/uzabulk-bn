import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { apiGetCategories } from "../../store/categories/actions";
import { apiGet } from "../../helpers/apiHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import {
  amountConversion,
  buildProductDetailUrl,
  getProductImageUrl,
  smoothScrollToTop,
} from "../../helpers/commonHelper";
import placeholder from "../../assets/images/default_name.webp";
import UXSkeleton from "../Common/UXSkeleton";

const MAX_CATEGORIES = 12;
const PRODUCTS_PER_CATEGORY = 4;
/** Cap parallel /api/v1/products/list calls so a remote MongoDB pool is not hammered at once. */
const CATEGORY_FETCH_CONCURRENCY = 3;

function resolveVisibleCategoryColumns() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w < 768) return 1;
  if (w < 992) return 2;
  return 4;
}
const FILTER_OPTIONS = [
  { id: "recommended", label: "Recommended" },
  { id: "popular", label: "Most Popular" },
  { id: "newest", label: "New Arrivals" },
  { id: "topRated", label: "Top Rated" },
  { id: "priceLow", label: "Lowest Price" },
  { id: "priceHigh", label: "Highest Price" },
  { id: "bestValue", label: "Best Value" },
  { id: "budget", label: "Budget Picks" },
  { id: "premium", label: "Premium Picks" },
  { id: "recentlyUpdated", label: "Recently Updated" },
  { id: "bestReviewed", label: "Best Reviewed" },
  { id: "fastMoving", label: "Fast Moving" },
  { id: "nameAZ", label: "Name: A to Z" },
  { id: "nameZA", label: "Name: Z to A" },
  { id: "inStock", label: "In Stock First" },
];

export default function OftenPurchasedCategories() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const level1 = useSelector((s) => s.categories.categories.level1 || []);
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);

  const [categoryProducts, setCategoryProducts] = useState({});
  const [loading, setLoading] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState("");
  const [activeFilter, setActiveFilter] = useState("recommended");
  const [visibleCategoryColumns, setVisibleCategoryColumns] = useState(() =>
    typeof window !== "undefined" ? resolveVisibleCategoryColumns() : 4
  );
  const swipeTouchRef = useRef(null);

  useLayoutEffect(() => {
    const sync = () => setVisibleCategoryColumns(resolveVisibleCategoryColumns());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  const resolveTrustText = (item) => {
    const moq = item?.moq || item?.minimumOrderQuantity || item?.minOrderQuantity;
    const sold = item?.sold || item?.totalSold || item?.orderCount;
    if (moq && sold) return `MOQ ${moq} • ${sold} sold`;
    if (moq) return `MOQ ${moq}`;
    if (sold) return `${sold} sold`;
    return "";
  };
  const handleOpenProduct = async (item) => {
    smoothScrollToTop();
    const resolved = await resolveCatalogProductId(item);
    const path = resolved
      ? buildProductDetailUrlFromResolved(resolved)
      : buildProductDetailUrl(item);
    if (!path) return;
    navigate(path);
  };

  const selectedCategories = useMemo(
    () => (level1 || []).slice(0, MAX_CATEGORIES),
    [level1]
  );
  const getItemTimestamp = (item) => {
    const raw = item?.date_created_utc || item?.createdAt || item?.date_created || item?.updatedAt;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  };
  const getItemPrice = (item) => {
    const price = Number(item?.price ?? item?.compare_price ?? 0);
    return Number.isFinite(price) ? price : 0;
  };
  const getItemSoldCount = (item) => {
    const sold = Number(item?.sold ?? item?.totalSold ?? item?.orderCount ?? 0);
    return Number.isFinite(sold) ? sold : 0;
  };
  const getItemRating = (item) => {
    const rating = Number(item?.average_rating ?? item?.rating ?? 0);
    return Number.isFinite(rating) ? rating : 0;
  };
  const getItemName = (item) => String(item?.name || "").toLowerCase().trim();
  const getItemValueScore = (item) => {
    const compare = Number(item?.compare_price ?? 0);
    const price = getItemPrice(item);
    const diff = compare - price;
    return Number.isFinite(diff) ? diff : 0;
  };
  const getItemInStockScore = (item) => {
    const status = String(item?.stock_status || "").toLowerCase();
    const quantity = Number(item?.stock_quantity ?? 0);
    if (status === "instock" || quantity > 0) return 1;
    return 0;
  };
  const sortProducts = (items = []) => {
    const sorted = [...items];
    if (activeFilter === "popular") {
      sorted.sort((a, b) => getItemSoldCount(b) - getItemSoldCount(a));
    } else if (activeFilter === "topRated") {
      sorted.sort((a, b) => getItemRating(b) - getItemRating(a));
    } else if (activeFilter === "bestReviewed") {
      sorted.sort((a, b) => {
        const reviewA = getItemRating(a) * (Number(a?.rating_count || 0) + 1);
        const reviewB = getItemRating(b) * (Number(b?.rating_count || 0) + 1);
        return reviewB - reviewA;
      });
    } else if (activeFilter === "fastMoving") {
      sorted.sort((a, b) => getItemSoldCount(b) - getItemSoldCount(a));
    } else if (activeFilter === "bestValue") {
      sorted.sort((a, b) => getItemValueScore(b) - getItemValueScore(a));
    } else if (activeFilter === "budget") {
      sorted.sort((a, b) => getItemPrice(a) - getItemPrice(b));
    } else if (activeFilter === "premium") {
      sorted.sort((a, b) => getItemPrice(b) - getItemPrice(a));
    } else if (activeFilter === "recentlyUpdated") {
      sorted.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
    } else if (activeFilter === "nameAZ") {
      sorted.sort((a, b) => getItemName(a).localeCompare(getItemName(b)));
    } else if (activeFilter === "nameZA") {
      sorted.sort((a, b) => getItemName(b).localeCompare(getItemName(a)));
    } else if (activeFilter === "inStock") {
      sorted.sort((a, b) => getItemInStockScore(b) - getItemInStockScore(a));
    } else if (activeFilter === "priceLow") {
      sorted.sort((a, b) => getItemPrice(a) - getItemPrice(b));
    } else if (activeFilter === "priceHigh") {
      sorted.sort((a, b) => getItemPrice(b) - getItemPrice(a));
    } else if (activeFilter === "recommended") {
      sorted.sort((a, b) => {
        const scoreA = getItemSoldCount(a) * 2 + getItemRating(a) * 5 + getItemTimestamp(a) / 1e10;
        const scoreB = getItemSoldCount(b) * 2 + getItemRating(b) * 5 + getItemTimestamp(b) / 1e10;
        return scoreB - scoreA;
      });
    } else {
      sorted.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
    }
    return sorted;
  };
  const categoriesWithMetrics = useMemo(
    () => selectedCategories.map((category) => {
      const items = categoryProducts[category?._id] || [];
      const newest = items.reduce((max, item) => Math.max(max, getItemTimestamp(item)), 0);
      const oldest = items.reduce((min, item) => {
        const ts = getItemTimestamp(item);
        if (!ts) return min;
        return min === 0 ? ts : Math.min(min, ts);
      }, 0);
      const avgPrice = items.length
        ? items.reduce((sum, item) => sum + getItemPrice(item), 0) / items.length
        : 0;
      const sold = items.reduce((sum, item) => sum + getItemSoldCount(item), 0);
      const rating = items.length
        ? items.reduce((sum, item) => sum + getItemRating(item), 0) / items.length
        : 0;
      const valueScore = items.reduce((sum, item) => sum + getItemValueScore(item), 0);
      const inStockCount = items.reduce((sum, item) => sum + getItemInStockScore(item), 0);
      const nameSample = items.length ? getItemName(items[0]) : "";
      return { category, newest, oldest, avgPrice, sold, rating, valueScore, inStockCount, nameSample };
    }),
    [selectedCategories, categoryProducts]
  );
  const sortedCategories = useMemo(() => {
    const sorted = [...categoriesWithMetrics];
    if (activeFilter === "popular") {
      sorted.sort((a, b) => b.sold - a.sold);
    } else if (activeFilter === "topRated") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else if (activeFilter === "bestReviewed") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else if (activeFilter === "fastMoving") {
      sorted.sort((a, b) => b.sold - a.sold);
    } else if (activeFilter === "bestValue") {
      sorted.sort((a, b) => b.valueScore - a.valueScore);
    } else if (activeFilter === "budget") {
      sorted.sort((a, b) => a.avgPrice - b.avgPrice);
    } else if (activeFilter === "premium") {
      sorted.sort((a, b) => b.avgPrice - a.avgPrice);
    } else if (activeFilter === "recentlyUpdated") {
      sorted.sort((a, b) => b.newest - a.newest);
    } else if (activeFilter === "nameAZ") {
      sorted.sort((a, b) => a.nameSample.localeCompare(b.nameSample));
    } else if (activeFilter === "nameZA") {
      sorted.sort((a, b) => b.nameSample.localeCompare(a.nameSample));
    } else if (activeFilter === "inStock") {
      sorted.sort((a, b) => b.inStockCount - a.inStockCount);
    } else if (activeFilter === "priceLow") {
      sorted.sort((a, b) => a.avgPrice - b.avgPrice);
    } else if (activeFilter === "priceHigh") {
      sorted.sort((a, b) => b.avgPrice - a.avgPrice);
    } else if (activeFilter === "recommended") {
      sorted.sort((a, b) => {
        const scoreA = a.sold * 2 + a.rating * 5 + a.newest / 1e10;
        const scoreB = b.sold * 2 + b.rating * 5 + b.newest / 1e10;
        return scoreB - scoreA;
      });
    } else {
      sorted.sort((a, b) => b.newest - a.newest);
    }
    return sorted.map((entry) => entry.category);
  }, [categoriesWithMetrics, activeFilter]);
  const orderedCategories = useMemo(() => {
    if (!sortedCategories.length) return [];
    const safeStart = ((startIndex % sortedCategories.length) + sortedCategories.length) % sortedCategories.length;
    return [
      ...sortedCategories.slice(safeStart),
      ...sortedCategories.slice(0, safeStart),
    ];
  }, [sortedCategories, startIndex]);
  const slidingCategories = useMemo(
    () => orderedCategories.slice(0, visibleCategoryColumns),
    [orderedCategories, visibleCategoryColumns]
  );

  const categoryProductsRef = useRef(categoryProducts);
  categoryProductsRef.current = categoryProducts;

  const selectedCategoriesRef = useRef(selectedCategories);
  selectedCategoriesRef.current = selectedCategories;

  const selectedCategoryIdsKey = useMemo(
    () => selectedCategories.map((c) => c?._id).filter(Boolean).join(","),
    [selectedCategories]
  );

  useEffect(() => {
    if (!level1?.length) {
      dispatch(apiGetCategories({ level: 1 }));
    }
  }, [dispatch, level1?.length]);

  useEffect(() => {
    if (!sortedCategories.length) return;
    setStartIndex((prev) => {
      const safe = ((prev % sortedCategories.length) + sortedCategories.length) % sortedCategories.length;
      return safe;
    });
  }, [sortedCategories.length]);

  useEffect(() => {
    let cancelled = false;

    const fetchForCategory = async (category) => {
      try {
        const response = await apiGet(PRODUCTS.LIST, {
          category: category?._id,
          limit: PRODUCTS_PER_CATEGORY,
          skip: 1,
          fieldName: "bestSeller",
          fieldValue: true,
        });
        return [category?._id, response?.data?.items || []];
      } catch (error) {
        return [category?._id, []];
      }
    };

    const run = async () => {
      const cats = selectedCategoriesRef.current;
      if (!cats.length) return;
      const prev = categoryProductsRef.current;
      const missingCategories = cats.filter(
        (category) =>
          category?._id && !Object.prototype.hasOwnProperty.call(prev, category._id)
      );
      if (!missingCategories.length) return;

      setLoading(true);
      try {
        let accum = { ...prev };
        for (let i = 0; i < missingCategories.length; i += CATEGORY_FETCH_CONCURRENCY) {
          if (cancelled) break;
          const chunk = missingCategories.slice(i, i + CATEGORY_FETCH_CONCURRENCY);
          const records = await Promise.all(chunk.map((category) => fetchForCategory(category)));
          if (cancelled) break;
          records.forEach(([categoryId, products]) => {
            if (categoryId) accum[categoryId] = products;
          });
          categoryProductsRef.current = accum;
          setCategoryProducts({ ...accum });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryIdsKey]);

  useEffect(() => {
    if (!slideDirection) return;
    const timer = setTimeout(() => setSlideDirection(""), 360);
    return () => clearTimeout(timer);
  }, [slideDirection]);

  const handleSlide = (direction) => {
    if (!sortedCategories.length) return;
    setSlideDirection(direction);
    setStartIndex((prev) => prev + (direction === "next" ? 1 : -1));
  };

  const handleSwipeTouchStart = (event) => {
    if (visibleCategoryColumns !== 1) return;
    const t = event.touches[0];
    swipeTouchRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleSwipeTouchEnd = (event) => {
    if (visibleCategoryColumns !== 1 || !swipeTouchRef.current) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - swipeTouchRef.current.x;
    const dy = t.clientY - swipeTouchRef.current.y;
    swipeTouchRef.current = null;
    const minTravel = 48;
    if (Math.abs(dx) < minTravel) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0) handleSlide("next");
    else handleSlide("prev");
  };

  const handleSwipeTouchCancel = () => {
    swipeTouchRef.current = null;
  };
  const hasLoadedAnyProducts = useMemo(
    () => Object.values(categoryProducts || {}).some((items) => (items || []).length > 0),
    [categoryProducts]
  );

  return (
    <div className="often_purchased_section mt-3">
      <div className="often_category_controls d-flex align-items-center gap-2 mb-2">
        <div className="often_filter_scroll_outer flex-grow-1 min-w-0">
          <div className="often_filter_nav d-flex flex-nowrap flex-md-wrap align-items-center gap-3 gap-md-4">
            {FILTER_OPTIONS.map((option) => (
              <span
                key={option.id}
                role="button"
                tabIndex={0}
                className={`often_filter_text ${activeFilter === option.id ? "is-active" : ""}`}
                onClick={() => {
                  setActiveFilter(option.id);
                  setStartIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveFilter(option.id);
                    setStartIndex(0);
                  }
                }}
              >
                {option.label}
              </span>
            ))}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="often_category_chevron"
            aria-label="Previous categories"
            onClick={() => handleSlide("prev")}
            disabled={!sortedCategories.length}
          >
            &#8249;
          </button>
          <button
            type="button"
            className="often_category_chevron"
            aria-label="Next categories"
            onClick={() => handleSlide("next")}
            disabled={!sortedCategories.length}
          >
            &#8250;
          </button>
        </div>
      </div>
      {loading && !hasLoadedAnyProducts ? (
        <div className="often_skeleton_wrap">
          <UXSkeleton type="product-grid" count={8} />
        </div>
      ) : (
        <div
          className={`often_category_slider${
            visibleCategoryColumns === 1 ? " often_category_slider--one-col" : ""
          }`}
          role={visibleCategoryColumns === 1 ? "region" : undefined}
          aria-label={
            visibleCategoryColumns === 1
              ? "Category products. Swipe left or right to change category."
              : undefined
          }
          onTouchStart={handleSwipeTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
          onTouchCancel={handleSwipeTouchCancel}
        >
          <div className={`often_category_track ${slideDirection ? `is-sliding-${slideDirection}` : ""}`}>
            {slidingCategories.map((category, idx) => {
              const items = sortProducts(categoryProducts[category?._id] || []);
              return (
                <div className="often_category_col" key={`${category?._id || "cat"}-${idx}`}>
                  <div className="often_category_box h-100">
                    <div className="often_category_box_head d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <h6 className="mb-0">{category?.catName || "Category"}</h6>
                      <Link
                        to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category?._id}&name=${encodeURIComponent(
                          category?.catName || "Category"
                        )}`}
                      >
                        View more
                      </Link>
                    </div>

                    <div className="often_category_products mt-2">
                      {(items || []).slice(0, PRODUCTS_PER_CATEGORY).map((item) => (
                        <button
                          type="button"
                          key={item?._id}
                          className="often_category_product_item new_arrival_product_card cursor-pointer text-start"
                          onClick={() => handleOpenProduct(item)}
                        >
                          <div className="new_arrival_media">
                            <img src={getProductImageUrl(item, placeholder)} alt={item?.name || "product"} />
                          </div>
                          <div className="home_product_card_body px-1 pt-2">
                            <p className="home_product_title mb-1">{item?.name}</p>
                            <p className="home_product_price mb-1">
                              {currentCurrency?.symbol} {amountConversion(item?.price, appConfig)}
                            </p>
                            <div className="home_product_footer">
                              <p className="home_product_meta mb-0">{resolveTrustText(item) || "\u00A0"}</p>
                              <span className="home_product_cta">View details</span>
                            </div>
                          </div>
                        </button>
                      ))}
                      {!loading && !items.length ? (
                        <p className="often_empty_text mb-0">No products found.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
