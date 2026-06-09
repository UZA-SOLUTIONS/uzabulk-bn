import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { getHomeFeedRefreshToken } from "../../helpers/commonHelper";
import {
  fetchCategoryRepresentativeImage,
  rotateHomeCategories,
} from "../../helpers/homeCategoryFeedHelper";
import {
  getHomeCategoryCircleImage,
  setHomeCategoryCircleImage,
} from "../../helpers/homeCategoryCircleImageCache";
import UXSkeleton from "../Common/UXSkeleton";

const MAX_CATEGORIES = 12;
const IMAGE_FETCH_CONCURRENCY = 4;

export default function CategoryCircleSlider() {
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const level2Categories = useSelector((s) => s.categories.categories.level2 || []);
  const [feedRefresh, setFeedRefresh] = useState(() => getHomeFeedRefreshToken());
  const [imageTick, setImageTick] = useState(0);
  const [isFetchingImages, setIsFetchingImages] = useState(false);

  useEffect(() => {
    setFeedRefresh(getHomeFeedRefreshToken());
  }, []);

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

  useEffect(() => {
    if (!categoryIdsKey) return;
    let cancelled = false;

    const loadCategoryProductImages = async () => {
      const cats = categoriesToShowRef.current;
      const refresh = feedRefreshRef.current;
      const missing = cats.filter(
        (c) => c?._id && !getHomeCategoryCircleImage(c._id, refresh)
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
              const imageUrl = await fetchCategoryRepresentativeImage(category, refresh);
              return [category._id, imageUrl];
            })
          );

          if (cancelled) break;
          resolved.forEach(([categoryId, imageUrl]) => {
            if (categoryId && imageUrl) {
              setHomeCategoryCircleImage(categoryId, imageUrl, refresh);
            }
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
      categoriesToShow
        .map((category) => {
          const id = category?._id;
          const fromProduct = id ? getHomeCategoryCircleImage(id, feedRefresh) : "";
          const fromCat = category?.catImage?.link;
          const resolvedImage = fromProduct || fromCat || "";
          return { ...category, resolvedImage };
        })
        .filter((c) => !!c.resolvedImage),
    [categoriesToShow, feedRefresh, imageTick]
  );

  const repeatCount = categoriesWithImages.length
    ? Math.max(3, Math.ceil(24 / categoriesWithImages.length))
    : 0;
  const animatedCategories = repeatCount
    ? Array.from({ length: repeatCount }, () => categoriesWithImages).flat()
    : [];
  const shiftPercent = repeatCount ? (100 / repeatCount).toFixed(4) : "50";

  if (!categoriesToShow.length) {
    return (
      <section className="home_category_circle_slider_wrap py-3">
        <div className="card_top_head d-flex align-items-center justify-content-center mb-3 text-center">
          <h4 className="home_category_circle_title mb-2">Categories for you</h4>
        </div>
        <UXSkeleton type="category-circles" count={10} />
      </section>
    );
  }

  if (isFetchingImages) {
    return (
      <section className="home_category_circle_slider_wrap py-3">
        <div className="card_top_head d-flex align-items-center justify-content-center mb-3 text-center">
          <h4 className="home_category_circle_title mb-2">Categories for you</h4>
        </div>
        <UXSkeleton type="category-circles" count={10} />
      </section>
    );
  }

  if (!categoriesWithImages.length) {
    return null;
  }

  return (
    <section className="home_category_circle_slider_wrap py-3">
      <div className="card_top_head d-flex align-items-center justify-content-center mb-3 text-center">
        <h4 className="home_category_circle_title mb-2">Categories for you</h4>
      </div>
      <div className="home_category_circle_slider">
        <div
          className="home_category_circle_track"
          style={{ "--marquee-shift": `${shiftPercent}%` }}
        >
          {animatedCategories.map((category, index) => (
            <Link
              to={`${ROUTES.PRODUCT_LISTING}?skip=1&category=${category?._id}&name=${encodeURIComponent(
                category?.catName || "Category"
              )}`}
              className="home_category_circle_item"
              key={`${category?._id || "cat"}-${index}`}
            >
              <div className="home_category_circle_image">
                <img
                  src={category?.resolvedImage}
                  alt={category?.catName || "Category"}
                />
              </div>
              <p>{category?.catName || "Category"}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
