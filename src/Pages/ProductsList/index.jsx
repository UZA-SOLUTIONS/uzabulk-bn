import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import AbortController from "abort-controller";

import BrowseCategoryStrip from "../../Components/Products/BrowseCategoryStrip";
import ProductsListingInfinite from "../../Components/Products/ProductsListingInfinite";
import SimilarProductsRow from "../../Components/Products/SimilarProductsRow";
import { extractMongoProductId } from "../../helpers/commonHelper";
import { APP_NAME } from "../../config/constants";
import { smoothScrollToTop } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import { useCategoryStripPin } from "../../hooks/useCategoryStripPin";
import { apiGetCategories } from "../../store/categories/actions";
import { apiGetProductDetail, apiGetProducts } from "../../store/products/actions";
import { clearProductList } from "../../store/products/slice";

const Productlist = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const isCategoriesHub = location.pathname === ROUTES.CATEGORIES;
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const level2Categories = useSelector((s) => s.categories.categories.level2 || []);
  const { detail } = useSelector((s) => s.products.productDetail);
  const { isLoading, items, hasMore, message, skip, others } = useSelector((s) => s.products.products);
  const cancelToken = useRef(null);
  const fetchLockRef = useRef(false);

  const limit = 32;
  const searchQuery = searchParams.get("search") || "";
  const imageQuery = searchParams.get("image") || "";
  const selectedSort = searchParams.get("sort")
    || (searchQuery || imageQuery ? "relevance" : "newest");
  const selectedCategory = searchParams.get("category") || "";

  const categoriesAll = useMemo(() => {
    const base = (level1Categories?.length ? level1Categories : level2Categories) || [];
    return base.filter((c) => c?._id && (c?.catName || c?.name));
  }, [level1Categories, level2Categories]);

  const categoryTabs = useMemo(
    () => [
      { id: "", label: "All products" },
      ...categoriesAll.map((c) => ({
        id: String(c._id),
        label: (c.catName || c.name || "Category").trim(),
      })),
    ],
    [categoriesAll]
  );

  const pageTitle = useMemo(() => {
    if (imageQuery) {
      const kw = others?.imageSearchKeyword || others?.imageSearchPhrase || searchQuery;
      return kw ? `Image search: ${kw}` : "Image search results";
    }
    if (searchQuery) return `Search: ${searchQuery}`;
    if (others?.category?.catName) return others.category.catName;
    if (searchParams.get("name")) return searchParams.get("name");
    return isCategoriesHub ? "Categories" : "All products";
  }, [imageQuery, searchQuery, others?.imageSearchKeyword, others?.imageSearchPhrase, others?.category?.catName, searchParams, isCategoriesHub]);

  const {
    catstripSentinelRef,
    catstripNavRef,
    catstripPinned,
    catstripSpacerHeight,
  } = useCategoryStripPin({
    enabled: categoryTabs.length > 0 && !searchQuery && !imageQuery,
    bodyClass: "products-catstrip-pinned",
  });

  const getSortQuery = (sortValue) => {
    switch (sortValue) {
      case "relevance":
        return { orderBy: "relevance", order: -1 };
      case "newest":
        return { orderBy: "date_created_utc", order: -1 };
      case "oldest":
        return { orderBy: "date_created_utc", order: 1 };
      case "price_low_high":
        return { orderBy: "price", order: 1 };
      case "price_high_low":
        return { orderBy: "price", order: -1 };
      case "name_az":
        return { orderBy: "name.keyword", order: 1 };
      case "name_za":
        return { orderBy: "name.keyword", order: -1 };
      case "rating_high_low":
        return { orderBy: "average_rating", order: -1 };
      default:
        return {};
    }
  };

  const sortedItems = useMemo(() => {
    const source = [...(items || [])];
    switch (selectedSort) {
      case "newest":
        return source.sort((a, b) => new Date(b?.date_created_utc || 0) - new Date(a?.date_created_utc || 0));
      case "oldest":
        return source.sort((a, b) => new Date(a?.date_created_utc || 0) - new Date(b?.date_created_utc || 0));
      case "price_low_high":
        return source.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
      case "price_high_low":
        return source.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
      case "name_az":
        return source.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      case "name_za":
        return source.sort((a, b) => String(b?.name || "").localeCompare(String(a?.name || "")));
      case "rating_high_low":
        return source.sort((a, b) => Number(b?.average_rating || 0) - Number(a?.average_rating || 0));
      default:
        return source;
    }
  }, [items, selectedSort]);

  const displayItems = useMemo(() => {
    if (filteredItemsNeedDetail()) {
      return sortedItems?.length <= limit && detail
        ? [detail, ...sortedItems.filter((i) => i._id !== detail._id)]
        : sortedItems;
    }
    return sortedItems;

    function filteredItemsNeedDetail() {
      const topIds = searchParams.get("topIds");
      return Boolean(topIds && sortedItems?.length <= limit);
    }
  }, [sortedItems, detail, limit, searchParams]);

  useEffect(() => {
    if (!level1Categories?.length) dispatch(apiGetCategories({ level: 1 }));
  }, [dispatch, level1Categories?.length]);

  useEffect(() => {
    if (level1Categories?.length || !level2Categories?.length) return;
    dispatch(apiGetCategories({ level: 2 }));
  }, [dispatch, level1Categories?.length, level2Categories?.length]);

  const fetchProducts = (init = false, pageSkip = null) => {
    if (cancelToken.current) cancelToken.current.abort();
    cancelToken.current = new AbortController();
    const searchTerm = searchParams.get("search") || "";
    const imageTerm = searchParams.get("image") || "";
    const query = {
      limit,
      skip: pageSkip ?? (init ? 1 : skip + 1),
      category: searchParams.get("category")
        ? String(searchParams.get("category"))
        : undefined,
      search: searchTerm || undefined,
      image: imageTerm || undefined,
      country: searchParams.get("country") || "en",
      suppressGlobalErrorToast: true,
      ...getSortQuery(selectedSort || (searchTerm || imageTerm ? "relevance" : "newest")),
    };
    dispatch(
      apiGetProducts({
        query,
        signal: cancelToken.current.signal,
      })
    );
  };

  useEffect(() => {
    if (!isLoading) fetchLockRef.current = false;
  }, [isLoading]);

  const handleFetchRequest = useCallback(
    (init = false) => {
      if (fetchLockRef.current) return;
      if (!init && (!hasMore || isLoading)) return;
      fetchLockRef.current = true;
      fetchProducts(init);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchProducts reads latest searchParams/skip
    [hasMore, isLoading, searchParams.toString(), skip]
  );

  useEffect(() => {
    smoothScrollToTop();
    dispatch(clearProductList("products"));
    fetchProducts(true, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when URL filters change
  }, [searchParams.toString()]);

  useEffect(() => {
    const topIds = searchParams.get("topIds");
    if (topIds) dispatch(apiGetProductDetail({ id: topIds }));
  }, [dispatch, searchParams]);

  const buildCategoryHref = (tab) => {
    const base =
      isCategoriesHub && !tab.id ? ROUTES.CATEGORIES : ROUTES.PRODUCT_LISTING;
    const params = new URLSearchParams();
    if (tab.id) {
      params.set("category", tab.id);
      params.set("name", tab.label);
    }
    if (selectedSort && selectedSort !== "relevance") params.set("sort", selectedSort);
    if (searchQuery) params.set("search", searchQuery);
    params.set("skip", "1");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const showCategoryStrip = categoryTabs.length > 0 && !searchQuery && !imageQuery;

  const similarAnchorId = useMemo(() => {
    const first = (displayItems || []).find((item) => {
      const id = extractMongoProductId(item);
      return id && /^[a-fA-F0-9]{24}$/.test(id);
    });
    return first ? extractMongoProductId(first) : "";
  }, [displayItems]);

  return (
    <div className="wrapList products_list_browse">
      <Helmet>
        <title>{APP_NAME} | {pageTitle}</title>
      </Helmet>
      <Container fluid className="products_list_browse__container px-3">
        {others?.category?.catImage ? (
          <div className="products_list_browse__hero mb-3">
            <img src={others.category.catImage} alt="" />
            <h1 className="products_list_category_title">{others?.category?.catName}</h1>
          </div>
        ) : null}

        <div className="home_discover_browse_outer products_list_browse__outer">
          <h1 className="products_list_browse__page_title">{pageTitle}</h1>
          {imageQuery ? (
            <p className="products_list_image_search_hint mb-3">
              Showing catalog matches for your uploaded photo
              {others?.imageSearchKeyword ? ` · “${others.imageSearchKeyword}”` : ""}
            </p>
          ) : null}

          {showCategoryStrip ? (
            <>
              <div ref={catstripSentinelRef} className="home_discover_catstrip_sentinel" aria-hidden="true" />
              {catstripSpacerHeight > 0 ? (
                <div className="home_discover_catstrip_spacer" style={{ height: catstripSpacerHeight }} aria-hidden />
              ) : null}
              <BrowseCategoryStrip
                tabs={categoryTabs}
                activeTabId={selectedCategory}
                navRef={catstripNavRef}
                isPinned={catstripPinned}
                getTabTo={buildCategoryHref}
                ariaLabel="Filter products by category"
                tablistId="products-list-category-tablist"
              />
            </>
          ) : null}

          <section className="home_discover_browse home_discover_browse--flat" aria-label={pageTitle}>
            <div className="home_discover_browse__body products_list_browse__grid">
              <ProductsListingInfinite
                items={displayItems}
                isLoading={isLoading}
                message={message}
                hasMore={hasMore}
                fetchRecords={handleFetchRequest}
                gridClassName="home_discover_browse__product_grid"
              />
            </div>
          </section>

          {similarAnchorId ? (
            <SimilarProductsRow
              productId={similarAnchorId}
              title="AI picks — similar products"
              limit={10}
              className="mt-4"
            />
          ) : null}
        </div>
      </Container>
    </div>
  );
};

export default Productlist;
