import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ProductsListingInfinite from "../Products/ProductsListingInfinite";
import UXSkeleton from "../Common/UXSkeleton";
import { apiGet } from "../../helpers/apiHelper";
import ROUTES from "../../helpers/routesHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import { apiGetCategories } from "../../store/categories/actions";

const PAGE_LIMIT = 24;

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

function listingLink(categoryId) {
  if (!categoryId) return ROUTES.PRODUCT_LISTING;
  return `${ROUTES.PRODUCT_LISTING}?category=${encodeURIComponent(categoryId)}`;
}

export default function DiscoverBrowseProducts() {
  const dispatch = useDispatch();
  const level1 = useSelector((s) => s.categories.categories.level1 || []);
  const level2 = useSelector((s) => s.categories.categories.level2 || []);

  const categoriesAll = useMemo(() => {
    const base = (level1?.length ? level1 : level2) || [];
    return base.filter((c) => c?._id && (c?.name || "").trim());
  }, [level1, level2]);

  const tabs = useMemo(
    () => [{ id: "", label: "All products" }, ...categoriesAll.map((c) => ({ id: c._id, label: c.name }))],
    [categoriesAll]
  );

  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [message, setMessage] = useState("");
  const nextSkipRef = useRef(1);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const activeCategoryRef = useRef(activeCategoryId);
  const tablistRef = useRef(null);

  activeCategoryRef.current = activeCategoryId;

  const activeFilterLabel = useMemo(() => {
    if (!activeCategoryId) return "All products";
    const cat = categoriesAll.find((c) => c._id === activeCategoryId);
    return cat?.name || "Category";
  }, [activeCategoryId, categoriesAll]);

  const stripScrollRef = useRef(null);
  const [canStripPrev, setCanStripPrev] = useState(false);
  const [canStripNext, setCanStripNext] = useState(false);

  const syncStripArrows = useCallback(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanStripPrev(scrollLeft > 2);
    setCanStripNext(max > 2 && scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = stripScrollRef.current;
    if (!el) return;
    syncStripArrows();
    el.addEventListener("scroll", syncStripArrows, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncStripArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", syncStripArrows);
      ro?.disconnect();
    };
  }, [syncStripArrows, tabs.length]);

  const scrollStrip = useCallback((dir) => {
    const el = stripScrollRef.current;
    if (!el) return;
    const step = Math.max(200, Math.floor(el.clientWidth * 0.55));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    inFlightRef.current = false;
  }, [activeCategoryId]);

  useEffect(() => {
    if (level1?.length) return;
    dispatch(apiGetCategories({ level: 1 }));
  }, [dispatch, level1?.length]);

  useEffect(() => {
    if (level1?.length || !level2?.length) return;
    dispatch(apiGetCategories({ level: 2 }));
  }, [dispatch, level1?.length, level2?.length]);

  const loadPage = useCallback(async (skip, categoryId, signal) => {
    const query = {
      limit: PAGE_LIMIT,
      skip,
      suppressGlobalErrorToast: true,
      ...(signal ? { signal } : {}),
    };
    if (categoryId) query.category = categoryId;

    const res = await apiGet(PRODUCTS.LIST, query);
    if (signal?.aborted) return null;
    if (!res || res.status !== "success") {
      throw new Error(res?.message || "Could not load products.");
    }
    const data = res.data || {};
    const batch = Array.isArray(data.items) ? data.items : [];
    const has = typeof data.hasMore === "boolean" ? data.hasMore : batch.length === PAGE_LIMIT;
    return { batch, hasMore: has, skip: data.skip ?? skip };
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      setInitialLoad(true);
      setIsLoading(true);
      setMessage("");
      nextSkipRef.current = 1;
      setItems([]);
      setHasMore(true);
      try {
        const result = await loadPage(1, activeCategoryId, ac.signal);
        if (ac.signal.aborted || !result) return;
        setItems(result.batch);
        nextSkipRef.current = result.skip;
        setHasMore(result.hasMore);
      } catch (e) {
        if (ac.signal.aborted || e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setItems([]);
        setHasMore(false);
        setMessage(e?.message || "Could not load products.");
      } finally {
        if (!ac.signal.aborted) {
          setIsLoading(false);
          setInitialLoad(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [activeCategoryId, loadPage]);

  const fetchRecords = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;
    const categorySnapshot = activeCategoryRef.current;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const nextSkip = nextSkipRef.current + 1;
      const result = await loadPage(nextSkip, categorySnapshot, null);
      if (!result) return;
      if (categorySnapshot !== activeCategoryRef.current) return;
      setItems((prev) => [...prev, ...result.batch]);
      nextSkipRef.current = result.skip;
      setHasMore(result.hasMore);
    } catch (e) {
      setHasMore(false);
      setMessage(e?.message || "Could not load more.");
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [hasMore, loadPage]);

  const selectTab = useCallback((tabId) => {
    setActiveCategoryId(tabId);
  }, []);

  const selectTabIndex = useCallback(
    (nextIndex) => {
      if (!tabs.length) return;
      const len = tabs.length;
      const idx = ((nextIndex % len) + len) % len;
      const nextId = tabs[idx].id;
      setActiveCategoryId(nextId);
      requestAnimationFrame(() => {
        const btn = document.getElementById(`home-discover-tab-${nextId || "all"}`);
        btn?.focus();
        btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
        syncStripArrows();
      });
    },
    [tabs, syncStripArrows]
  );

  const handleTablistKeyDown = useCallback(
    (e) => {
      if (!tabs.length) return;
      const root = tablistRef.current;
      if (!root) return;
      const buttons = [...root.querySelectorAll('[role="tab"]')];
      let i = buttons.indexOf(document.activeElement);
      if (i < 0) i = tabs.findIndex((t) => t.id === activeCategoryId);
      if (i < 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        selectTabIndex(i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectTabIndex(i - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        selectTabIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        selectTabIndex(tabs.length - 1);
      }
    },
    [activeCategoryId, selectTabIndex, tabs]
  );
  return (
    <div className="home_discover_browse_outer home_feed_section_offset px-3 w-100">
      <h2 id="home-discover-browse-title" className="visually-hidden">
        All products — filter by category
      </h2>

      {/* Category text slider — outside product card (reference UI) */}
      <div className="home_discover_browse_catstrip">
        <div className="home_discover_browse_catstrip__inner">
          {canStripPrev ? (
            <button
              type="button"
              className="home_discover_browse_catstrip__arrow home_discover_browse_catstrip__arrow--prev"
              aria-label="Scroll categories left"
              onClick={() => scrollStrip("prev")}
            >
              <Chevron dir="prev" />
            </button>
          ) : (
            <span className="home_discover_browse_catstrip__arrow-spacer" aria-hidden />
          )}
          <div ref={stripScrollRef} className="home_discover_browse_catstrip__track">
            <div
              ref={tablistRef}
              className="home_discover_browse_catstrip__tablist"
              role="tablist"
              aria-labelledby="home-discover-browse-title"
              onKeyDown={handleTablistKeyDown}
            >
              {tabs.map((tab, idx) => (
                <React.Fragment key={tab.id || "all"}>
                  <button
                    type="button"
                    role="tab"
                    id={`home-discover-tab-${tab.id || "all"}`}
                    aria-selected={tab.id === activeCategoryId}
                    aria-controls="home-discover-browse-panel"
                    tabIndex={tab.id === activeCategoryId ? 0 : -1}
                    className={`home_discover_browse_catstrip__tab${
                      tab.id === activeCategoryId ? " home_discover_browse_catstrip__tab--active" : ""
                    }${idx === 0 ? " home_discover_browse_catstrip__tab--sticky" : ""}`}
                    onClick={() => {
                      selectTab(tab.id);
                      requestAnimationFrame(() => {
                        document.getElementById(`home-discover-tab-${tab.id || "all"}`)?.scrollIntoView({
                          inline: "nearest",
                          block: "nearest",
                          behavior: "smooth",
                        });
                        syncStripArrows();
                      });
                    }}
                  >
                    {tab.label}
                  </button>
                  {idx === 0 && categoriesAll.length > 0 ? (
                    <span className="home_discover_browse_catstrip__divider" aria-hidden="true" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
            <Link className="home_discover_browse_catstrip__categories-hub" to={ROUTES.CATEGORIES}>
              All categories
            </Link>
          </div>
          <button
            type="button"
            className="home_discover_browse_catstrip__arrow home_discover_browse_catstrip__arrow--next"
            aria-label="Scroll categories right"
            disabled={!canStripNext}
            onClick={() => scrollStrip("next")}
          >
            <Chevron dir="next" />
          </button>
        </div>
      </div>

      <section className="home_discover_browse" aria-labelledby="home-discover-browse-title">
        <div className="home_discover_browse__card_head">
          <p
            id="home-discover-browse-status"
            className="home_discover_browse__filter_status visually-hidden"
            aria-live="polite"
          >
            Showing: {activeFilterLabel}
          </p>
          <Link className="home_discover_browse__see_all" to={listingLink(activeCategoryId)}>
            See all <span aria-hidden>&gt;</span>
          </Link>
        </div>

        <div
          id="home-discover-browse-panel"
          className="home_discover_browse__body"
          role="tabpanel"
          aria-labelledby="home-discover-browse-title"
        >
          {initialLoad ? (
            <div className="home_discover_browse__skeleton" aria-busy="true">
              <UXSkeleton count={8} />
            </div>
          ) : (
            <ProductsListingInfinite
              items={items}
              isLoading={isLoading}
              message={message}
              hasMore={hasMore}
              fetchRecords={fetchRecords}
            />
          )}
        </div>
      </section>
    </div>
  );
}
