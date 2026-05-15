import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { apiGet } from "../../helpers/apiHelper";
import { getProductImageUrl } from "../../helpers/commonHelper";
import {
  getHomeCategoryCircleImage,
  setHomeCategoryCircleImage,
} from "../../helpers/homeCategoryCircleImageCache";
import { PRODUCTS } from "../../helpers/urlHelper";
import placeholder from "../../assets/images/default_name.webp";
import UXSkeleton from "../Common/UXSkeleton";

const MAX_CATEGORIES = 16;
const IMAGE_FETCH_CONCURRENCY = 4;

const Chevron = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function SourceByCategory() {
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const level2Categories = useSelector((s) => s.categories.categories.level2 || []);
  const [imageTick, setImageTick] = useState(0);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const categoriesToShow = useMemo(() => {
    const base = (level1Categories?.length ? level1Categories : level2Categories) || [];
    return base.slice(0, MAX_CATEGORIES);
  }, [level1Categories, level2Categories]);

  const categoryIdsKey = useMemo(
    () => categoriesToShow.map((c) => c?._id).filter(Boolean).join(","),
    [categoriesToShow]
  );

  const categoriesToShowRef = useRef(categoriesToShow);
  categoriesToShowRef.current = categoriesToShow;

  useEffect(() => {
    if (!categoryIdsKey) return;
    let cancelled = false;

    const loadCategoryProductImages = async () => {
      const cats = categoriesToShowRef.current;
      const missing = cats.filter(
        (c) => c?._id && !c?.catImage?.link && !getHomeCategoryCircleImage(c._id)
      );
      if (!missing.length) {
        setIsFetchingImages(false);
        return;
      }

      setIsFetchingImages(true);
      try {
        for (let i = 0; i < missing.length; i += IMAGE_FETCH_CONCURRENCY) {
          if (cancelled) break;
          const chunk = missing.slice(i, i + IMAGE_FETCH_CONCURRENCY);
          const resolved = await Promise.all(
            chunk.map(async (category) => {
              try {
                const res = await apiGet(PRODUCTS.LIST, {
                  category: category._id,
                  limit: 1,
                  skip: 1,
                });
                const product = res?.data?.items?.[0];
                return [category._id, getProductImageUrl(product, "")];
              } catch {
                return [category._id, ""];
              }
            })
          );

          if (cancelled) break;
          resolved.forEach(([categoryId, imageUrl]) => {
            if (categoryId && imageUrl) setHomeCategoryCircleImage(categoryId, imageUrl);
          });
        }
      } finally {
        if (!cancelled) {
          setIsFetchingImages(false);
          setImageTick((t) => t + 1);
        }
      }
    };

    loadCategoryProductImages();
    return () => {
      cancelled = true;
    };
  }, [categoryIdsKey]);

  const categoriesWithImages = useMemo(
    () =>
      categoriesToShow.map((category) => {
        const id = category?._id;
        const fromCat = category?.catImage?.link;
        const resolvedImage = fromCat || (id ? getHomeCategoryCircleImage(id) : "") || "";
        return { ...category, resolvedImage };
      }),
    [categoriesToShow, imageTick]
  );

  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 2);
    setCanNext(scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      ro?.disconnect();
    };
  }, [syncArrows, categoriesWithImages.length, imageTick]);

  const scrollByDir = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  if (!categoriesToShow.length) {
    return (
      <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
        <h2 id="home-source-by-category-title" className="home_source_by_category__title">
          Source by category
        </h2>
        <UXSkeleton type="category-circles" count={8} />
      </section>
    );
  }

  if (isFetchingImages && !categoriesWithImages.some((c) => c.resolvedImage)) {
    return (
      <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
        <h2 id="home-source-by-category-title" className="home_source_by_category__title">
          Source by category
        </h2>
        <UXSkeleton type="category-circles" count={8} />
      </section>
    );
  }

  return (
    <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
      <h2 id="home-source-by-category-title" className="home_source_by_category__title">
        Source by category
      </h2>

      <div className="home_source_by_category__wrap">
        <button
          type="button"
          className="home_source_by_category__arrow home_source_by_category__arrow--prev"
          onClick={() => scrollByDir("prev")}
          disabled={!canPrev}
          aria-label="Scroll categories left"
        >
          <Chevron dir="prev" />
        </button>
        <button
          type="button"
          className="home_source_by_category__arrow home_source_by_category__arrow--next"
          onClick={() => scrollByDir("next")}
          disabled={!canNext}
          aria-label="Scroll categories right"
        >
          <Chevron dir="next" />
        </button>

        <div ref={trackRef} className="home_source_by_category__track">
          {categoriesWithImages.map((category) => {
            const id = category?._id;
            const name = category?.catName || "Category";
            const to = `${ROUTES.PRODUCT_LISTING}?skip=1&category=${id}&name=${encodeURIComponent(name)}`;
            const img = category?.resolvedImage || placeholder;
            return (
              <Link key={id || name} to={to} className="home_source_category_card">
                <div className="home_source_category_card__head">
                  <span className="home_source_category_card__name">{name}</span>
                  <span className="home_source_category_card__explore">Explore</span>
                </div>
                <div className="home_source_category_card__image">
                  <img src={img} alt="" loading="lazy" decoding="async" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
