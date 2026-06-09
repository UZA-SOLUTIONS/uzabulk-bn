import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { getHomeFeedRefreshToken } from "../../helpers/commonHelper";
import {
  fetchCategoryRepresentativeImage,
  fetchCategoryThumbnailsBatch,
  getCategoryDisplayName,
  resolveCategoryIconUrl,
  rotateHomeCategories,
} from "../../helpers/homeCategoryFeedHelper";
import { apiGetCategories } from "../../store/categories/actions";
import {
  clearHomeCategoryCircleImage,
  getHomeCategoryCircleImage,
  setHomeCategoryCircleImage,
} from "../../helpers/homeCategoryCircleImageCache";
import UXSkeleton from "../Common/UXSkeleton";

const MAX_CATEGORIES = 16;
const IMAGE_FETCH_CONCURRENCY = 8;
const SKELETON_CARD_COUNT = 6;

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

function SourceCategoryCard({ category, imageUrl, onRequestImage, onImageError, priority = false }) {
  const id = String(category?._id || "");
  const name = getCategoryDisplayName(category) || "Category";
  const to = `${ROUTES.PRODUCT_LISTING}?skip=1&category=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
  const [imgReady, setImgReady] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setImgReady(false);
    if (!imageUrl) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgReady(true);
    }
  }, [imageUrl]);

  useEffect(() => {
    if (!id || imageUrl) return;
    onRequestImage?.(category);
  }, [category, id, imageUrl, onRequestImage]);

  return (
    <Link to={to} className="home_source_category_card">
      <div className="home_source_category_card__head">
        <span className="home_source_category_card__name">{name}</span>
        <span className="home_source_category_card__explore">Explore</span>
      </div>
      <div className="home_source_category_card__image">
        {!imgReady ? (
          <span className="home_source_category_card__img_placeholder shimmer" aria-hidden />
        ) : null}
        {imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => setImgReady(true)}
            onError={() => {
              setImgReady(false);
              onImageError?.(category);
            }}
            style={{ opacity: imgReady ? 1 : 0 }}
          />
        ) : null}
      </div>
    </Link>
  );
}

export default function SourceByCategory() {
  const dispatch = useDispatch();
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const level2Categories = useSelector((s) => s.categories.categories.level2 || []);
  const categoriesLoading = useSelector((s) => s.categories.categories.isLoading);
  const [feedRefresh, setFeedRefresh] = useState(() => getHomeFeedRefreshToken());
  const [imageTick, setImageTick] = useState(0);
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    setFeedRefresh(getHomeFeedRefreshToken());
  }, []);

  useEffect(() => {
    if (!level1Categories?.length) {
      dispatch(apiGetCategories({ level: 1 }));
    }
  }, [dispatch, level1Categories?.length]);

  useEffect(() => {
    if (level1Categories?.length || !level2Categories?.length) return;
    dispatch(apiGetCategories({ level: 2 }));
  }, [dispatch, level1Categories?.length, level2Categories?.length]);

  const categoriesToShow = useMemo(() => {
    const base = (level1Categories?.length ? level1Categories : level2Categories) || [];
    return rotateHomeCategories(base, feedRefresh, MAX_CATEGORIES);
  }, [level1Categories, level2Categories, feedRefresh]);

  const categoryIdsKey = useMemo(
    () => `${feedRefresh}:${categoriesToShow.map((c) => c?._id).filter(Boolean).join(",")}`,
    [categoriesToShow, feedRefresh]
  );

  const categoriesToShowRef = useRef(categoriesToShow);
  categoriesToShowRef.current = categoriesToShow;
  const feedRefreshRef = useRef(feedRefresh);
  feedRefreshRef.current = feedRefresh;
  const pendingFetchRef = useRef(new Set());

  useEffect(() => {
    pendingFetchRef.current = new Set();
  }, [categoryIdsKey]);

  const resolveImageUrl = useCallback(
    (category) => {
      const id = String(category?._id || "").trim();
      if (!id) return "";
      return getHomeCategoryCircleImage(id, feedRefresh) || resolveCategoryIconUrl(category) || "";
    },
    [feedRefresh, imageTick]
  );

  const requestCategoryImage = useCallback(
    async (category, { force = false } = {}) => {
      const id = String(category?._id || "").trim();
      if (!id) return;
      const refresh = feedRefreshRef.current;
      if (!force && getHomeCategoryCircleImage(id, refresh)) return;
      if (pendingFetchRef.current.has(id)) return;
      pendingFetchRef.current.add(id);

      try {
        const imageUrl = await fetchCategoryRepresentativeImage(category, refresh);
        if (imageUrl) setHomeCategoryCircleImage(id, imageUrl, refresh);
      } finally {
        pendingFetchRef.current.delete(id);
        setImageTick((t) => t + 1);
      }
    },
    []
  );

  const handleImageError = useCallback(
    (category) => {
      const id = String(category?._id || "").trim();
      if (!id) return;
      clearHomeCategoryCircleImage(id, feedRefreshRef.current);
      requestCategoryImage(category, { force: true });
    },
    [requestCategoryImage]
  );

  useEffect(() => {
    if (!categoryIdsKey) return;
    let cancelled = false;

    const prefetchMissing = async () => {
      const cats = categoriesToShowRef.current;
      const refresh = feedRefreshRef.current;
      const needsThumb = cats.filter((c) => {
        const id = String(c?._id || "").trim();
        if (!id) return false;
        return !getHomeCategoryCircleImage(id, refresh);
      });

      if (!needsThumb.length) return;

      const batch = await fetchCategoryThumbnailsBatch(needsThumb, refresh);
      if (cancelled) return;

      Object.entries(batch || {}).forEach(([id, url]) => {
        const key = String(id || "").trim();
        if (key && url) setHomeCategoryCircleImage(key, url, refresh);
      });
      if (Object.keys(batch || {}).length) {
        setImageTick((t) => t + 1);
      }

      const stillMissing = needsThumb.filter((c) => {
        const id = String(c._id);
        return !getHomeCategoryCircleImage(id, refresh);
      });

      for (let i = 0; i < stillMissing.length; i += IMAGE_FETCH_CONCURRENCY) {
        if (cancelled) break;
        const chunk = stillMissing.slice(i, i + IMAGE_FETCH_CONCURRENCY);
        await Promise.all(chunk.map((category) => requestCategoryImage(category)));
      }
    };

    prefetchMissing();
    return () => {
      cancelled = true;
    };
  }, [categoryIdsKey, requestCategoryImage]);

  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 2);
    setCanNext(max > 2 && scrollLeft < max - 2);
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
  }, [syncArrows, categoriesToShow.length, imageTick]);

  const scrollByDir = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const hasAnyCategories = (level1Categories?.length || 0) > 0 || (level2Categories?.length || 0) > 0;
  const waitingForCategories = categoriesLoading && !hasAnyCategories;

  if (waitingForCategories) {
    return (
      <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
        <h2 id="home-source-by-category-title" className="home_source_by_category__title">
          Source by category
        </h2>
        <UXSkeleton type="source-by-category" count={SKELETON_CARD_COUNT} />
      </section>
    );
  }

  if (!hasAnyCategories) {
    return (
      <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
        <h2 id="home-source-by-category-title" className="home_source_by_category__title">
          Source by category
        </h2>
        <p className="text-muted mb-0 small">
          Categories could not be loaded. Check that the API is running and MongoDB is reachable, then refresh.
        </p>
      </section>
    );
  }

  if (!categoriesToShow.length) {
    return (
      <section className="home_source_by_category py-3" aria-labelledby="home-source-by-category-title">
        <h2 id="home-source-by-category-title" className="home_source_by_category__title">
          Source by category
        </h2>
        <p className="text-muted mb-0 small">No categories available to display.</p>
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
          {categoriesToShow.map((category, index) => (
            <SourceCategoryCard
              key={String(category._id)}
              category={category}
              imageUrl={resolveImageUrl(category)}
              onRequestImage={requestCategoryImage}
              onImageError={handleImageError}
              priority={index < 4}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
