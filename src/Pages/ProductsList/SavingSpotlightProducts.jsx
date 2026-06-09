import React, { useEffect, useMemo, useState } from "react";
import { Row, Col, Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";

import ProductsListingInfinite from "../../Components/Products/ProductsListingInfinite";
import { APP_NAME } from "../../config/constants";
import { smoothScrollToTop } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import { apiGetCategories } from "../../store/categories/actions";
import { apiGetProductDetail, apiGetSavingSpotlightProducts } from "../../store/products/actions";
import { clearProductList } from "../../store/products/slice";

const SavingSpotlightProducts = () => {
  let [searchParams, setSearchParams] = useSearchParams();

  const dispatch = useDispatch();
  const level1Categories = useSelector((s) => s.categories.categories.level1 || []);
  const { detail } = useSelector((s) => s.products.productDetail);
  const { isLoading, items, hasMore, message, skip } = useSelector((s) => s.products.savingSpotlightProducts);

  const limit = 32;
  const [sidebarSearch, setSidebarSearch] = useState(searchParams.get("search") || "");
  const selectedCategory = searchParams.get("category");

  const relatedCategories = useMemo(() => {
    return (level1Categories || []).filter((cat) => cat?._id !== selectedCategory).slice(0, 8);
  }, [level1Categories, selectedCategory]);

  useEffect(() => {
    setSidebarSearch(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!level1Categories?.length) {
      dispatch(apiGetCategories({ level: 1 }));
    }
  }, [dispatch, level1Categories?.length]);

  const fetchRecords = (init = false) => {
    dispatch(
      apiGetSavingSpotlightProducts({
        limit: limit,
        skip: init ? 1 : skip + 1,
        category: searchParams.get("category"),
        search: searchParams.get("search"),
      })
    );
  };

  useEffect(() => {
    smoothScrollToTop();
    dispatch(clearProductList("savingSpotlightProducts"));
    fetchRecords(true);
  }, [searchParams]);

  useEffect(() => {
    const topIds = searchParams.get("topIds");
    if (topIds) {
      dispatch(apiGetProductDetail({ id: topIds }));
    }
  }, [dispatch, searchParams]);

  const handleSidebarSearchSubmit = (event) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (sidebarSearch?.trim()) {
      nextParams.set("search", sidebarSearch.trim());
    } else {
      nextParams.delete("search");
    }
    nextParams.set("skip", "1");
    setSearchParams(nextParams);
  };

  return (
    <div className="wrapList">
      <Helmet>
        <title>{APP_NAME} | Shop</title>
      </Helmet>
      <Container fluid>
        <Row>
          <Col lg={2} md={4} sm={12} className="mb-3">
            <div className="products_sort_sidebar">
              <h6>Search in category</h6>
              <form onSubmit={handleSidebarSearchSubmit} className="products_sidebar_search mb-3">
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Search products..."
                />
                <button type="submit">Go</button>
              </form>

              <div className="products_sidebar_section">
                <h6>Related categories</h6>
                <div className="products_related_categories">
                  {relatedCategories.map((category) => (
                    <Link
                      key={category._id}
                      to={`${ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING}?category=${category._id}&name=${encodeURIComponent(category?.catName || "Category")}`}
                    >
                      {category?.catName}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Col>
          <Col lg={10} md={8} sm={12}>
            <h5 className="all_product_head text-start mb-4">
              {searchParams.get("search")
                ? `Search for "${searchParams.get("search")}"`
                : "Saving Spotlight Products"}
            </h5>
            <ProductsListingInfinite
              {...{
                items:
                  items?.length <= limit && detail
                    ? [
                      ...[
                        detail,
                        ...items?.filter((i) => i._id !== detail._id),
                      ],
                    ]
                    : items,
                isLoading,
                message,
                hasMore,
                fetchRecords,
              }}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default SavingSpotlightProducts;
