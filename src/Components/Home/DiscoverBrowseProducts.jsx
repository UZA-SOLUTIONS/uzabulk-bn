import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import BrowseCategoryStrip from "../Products/BrowseCategoryStrip";
import ProductsListingInfinite from "../Products/ProductsListingInfinite";
import SimilarProductsRow from "../Products/SimilarProductsRow";
import UXSkeleton from "../Common/UXSkeleton";
import { useCategoryStripPin } from "../../hooks/useCategoryStripPin";
import { apiGet } from "../../helpers/apiHelper";
import {
  extractMongoProductId,
  getHomeFeedRefreshToken,
  getProductDedupeKey,
  mergeUniqueProducts,
  normalizeHomeCatalogProducts,
} from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import { apiGetCategories } from "../../store/categories/actions";

const PAGE_LIMIT_CATEGORY = 32;
const ALL_PRODUCTS_CHUNK = 48;
/** Keep loading pages on first paint until at least this many cards (or catalog ends). */
const MIN_HOME_VISIBLE_PRODUCTS = 24;
const MAX_INITIAL_PREFETCH_PAGES = 8;

function categoryLabel(category) {
  return (category?.catName || category?.name || "").trim();
}

function listingLink(categoryId, categoryName) {
  if (!categoryId) return ROUTES.PRODUCT_LISTING;
  const name = categoryName ? `&name=${encodeURIComponent(categoryName)}` : "";
  return `${ROUTES.PRODUCT_LISTING}?category=${encodeURIComponent(categoryId)}${name}`;
}

export default function DiscoverBrowseProducts() {
  const dispatch = useDispatch();
  const level1 = useSelector((s) => s.categories.categories.level1 || []);
  const level2 = useSelector((s) => s.categories.categories.level2 || []);
  const newArrivalItems = useSelector((s) => s.products.homeNewArrivalProducts?.items || []);

  const categoriesAll = useMemo(() => {
    const base = (level1?.length ? level1 : level2) || [];
    return base.filter((c) => c?._id && categoryLabel(c));
  }, [level1, level2]);

  const tabs = useMemo(
    () => [
      { id: "", label: "All products" },
      ...categoriesAll.map((c) => ({ id: String(c._id), label: categoryLabel(c) })),
    ],
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
  activeCategoryRef.current = activeCategoryId;

  const activeFilterLabel = useMemo(() => {
    if (!activeCategoryId) return "All products";
    const cat = categoriesAll.find((c) => String(c._id) === String(activeCategoryId));
    return categoryLabel(cat) || "Category";
  }, [activeCategoryId, categoriesAll]);

  const {
    catstripSentinelRef,
    catstripNavRef,
    catstripPinned,
    catstripSpacerHeight,
  } = useCategoryStripPin({ enabled: tabs.length > 0, bodyClass: "home-catstrip-pinned" });
  const [feedRefresh, setFeedRefresh] = useState(() => getHomeFeedRefreshToken());

  const newArrivalExcludeKeys = useMemo(() => {
    if (activeCategoryId) return null;
    const keys = new Set();
    newArrivalItems.forEach((item) => {
      const key = getProductDedupeKey(item);
      if (key) keys.add(key);
    });
    return keys.size ? keys : null;
  }, [activeCategoryId, newArrivalItems]);

  const sanitizeBatch = useCallback((batch) => {
    const cleaned = normalizeHomeCatalogProducts(batch, { excludeKeys: newArrivalExcludeKeys });
    if (cleaned.length > 0 || !newArrivalExcludeKeys?.size) {
      return cleaned;
    }
    return normalizeHomeCatalogProducts(batch);
  }, [newArrivalExcludeKeys]);

  useEffect(() => {
    inFlightRef.current = false;
  }, [activeCategoryId]);

  useEffect(() => {
    setFeedRefresh(getHomeFeedRefreshToken());
  }, []);

  useEffect(() => {
    if (level1?.length) return;
    dispatch(apiGetCategories({ level: 1 }));
  }, [dispatch, level1?.length]);

  useEffect(() => {
    if (level1?.length || !level2?.length) return;
    dispatch(apiGetCategories({ level: 2 }));
  }, [dispatch, level1?.length, level2?.length]);

  const loadPage = useCallback(async (skip, categoryId, signal) => {
    const pageLimit = categoryId ? PAGE_LIMIT_CATEGORY : ALL_PRODUCTS_CHUNK;
    const query = {
      limit: pageLimit,
      skip,
      suppressGlobalErrorToast: true,
      ...(signal ? { signal } : {}),
    };
    if (categoryId) {
      query.category = String(categoryId);
    } else {
      query.refresh = feedRefresh;
      query.homeBrowse = true;
    }

    const res = await apiGet(PRODUCTS.LIST, query);
    if (signal?.aborted) return null;
    if (!res || res.status !== "success") {
      throw new Error(res?.message || "Could not load products.");
    }
    const data = res.data || {};
    const batch = Array.isArray(data.items) ? data.items : [];
    const has =
      typeof data.hasMore === "boolean"
        ? data.hasMore
        : batch.length >= pageLimit;
    return { batch, hasMore: has, skip: Number(data.skip ?? skip) || skip };
  }, [feedRefresh]);

  const loadUntilFilled = useCallback(
    async (startSkip, categoryId, signal, minCount = MIN_HOME_VISIBLE_PRODUCTS) => {
      let merged = [];
      let pageSkip = startSkip;
      let has = true;
      let lastSkip = startSkip;
      let attempts = 0;

      while (merged.length < minCount && has && attempts < MAX_INITIAL_PREFETCH_PAGES) {
        const result = await loadPage(pageSkip, categoryId, signal);
        if (!result) break;
        lastSkip = result.skip;
        has = result.hasMore;
        merged = mergeUniqueProducts(merged, sanitizeBatch(result.batch));
        pageSkip = lastSkip + 1;
        attempts += 1;
        if (!result.batch.length && !has) break;
      }

      return { items: merged, hasMore: has, skip: lastSkip };
    },
    [loadPage, sanitizeBatch]
  );

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
        const filled = await loadUntilFilled(1, activeCategoryId, ac.signal);
        if (ac.signal.aborted || !filled) return;
        setItems(filled.items);
        nextSkipRef.current = filled.skip;
        setHasMore(filled.hasMore);
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
  }, [activeCategoryId, feedRefresh, loadUntilFilled]);

  const fetchRecords = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;
    const categorySnapshot = activeCategoryRef.current;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      let pageSkip = nextSkipRef.current + 1;
      let merged = [];
      let has = true;
      let lastSkip = pageSkip;
      let attempts = 0;
      const minBatch = 12;

      while (merged.length < minBatch && has && attempts < 6) {
        const result = await loadPage(pageSkip, categorySnapshot, null);
        if (!result) return;
        if (categorySnapshot !== activeCategoryRef.current) return;
        lastSkip = result.skip;
        has = result.hasMore;
        merged = mergeUniqueProducts(merged, sanitizeBatch(result.batch));
        pageSkip = lastSkip + 1;
        attempts += 1;
        if (!result.batch.length && !has) break;
      }

      if (!merged.length) {
        if (attempts > 0) {
          nextSkipRef.current = lastSkip;
        }
        setHasMore(has);
        return;
      }

      setItems((prev) => mergeUniqueProducts(prev, merged));
      nextSkipRef.current = lastSkip;
      setHasMore(has);
    } catch (e) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
      setHasMore(false);
      setMessage(e?.message || "Could not load more.");
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [hasMore, loadPage, sanitizeBatch]);

  const selectTab = useCallback((tabId) => {
    setActiveCategoryId(tabId ? String(tabId) : "");
  }, []);

  const selectTabIndex = useCallback(
    (nextIndex) => {
      if (!tabs.length) return;
      const len = tabs.length;
      const idx = ((nextIndex % len) + len) % len;
      const nextId = tabs[idx].id;
      setActiveCategoryId(nextId);
      requestAnimationFrame(() => {
        const btn = document.getElementById(`browse-tab-${nextId || "all"}`);
        btn?.focus();
        btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
      });
    },
    [tabs]
  );

  const handleTablistKeyDown = useCallback(
    (e) => {
      if (!tabs.length) return;
      const root = document.getElementById("home-discover-category-tablist");
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

  const similarAnchorId = useMemo(() => {
    const first = (items || []).find((item) => {
      const id = extractMongoProductId(item);
      return id && /^[a-fA-F0-9]{24}$/.test(id);
    });
    return first ? extractMongoProductId(first) : "";
  }, [items]);

  return (
    <div className="home_discover_browse_outer home_feed_section_offset px-3 w-100">
      <h2 id="home-discover-browse-title" className="visually-hidden">
        All products — filter by category
      </h2>

      <div ref={catstripSentinelRef} className="home_discover_catstrip_sentinel" aria-hidden="true" />
      {catstripSpacerHeight > 0 ? (
        <div className="home_discover_catstrip_spacer" style={{ height: catstripSpacerHeight }} aria-hidden />
      ) : null}
      <BrowseCategoryStrip
        tabs={tabs}
        activeTabId={activeCategoryId}
        navRef={catstripNavRef}
        isPinned={catstripPinned}
        onTabClick={selectTab}
        onTabKeyDown={handleTablistKeyDown}
        ariaLabel="Filter all products by category"
        tablistId="home-discover-category-tablist"
      />

      <section className="home_discover_browse home_discover_browse--flat" aria-labelledby="home-discover-browse-title">
        <div className="home_discover_browse__card_head">
          <p
            id="home-discover-browse-status"
            className="home_discover_browse__filter_status visually-hidden"
            aria-live="polite"
          >
            Showing: {activeFilterLabel}
          </p>
          <Link
            className="home_discover_browse__see_all"
            to={listingLink(activeCategoryId, activeFilterLabel !== "All products" ? activeFilterLabel : "")}
          >
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
              gridClassName="home_discover_browse__product_grid"
            />
          )}
        </div>
      </section>

      {similarAnchorId ? (
        <SimilarProductsRow
          productId={similarAnchorId}
          title="AI picks — similar products"
          limit={10}
          className="mt-3"
        />
      ) : null}
    </div>
  );
}
