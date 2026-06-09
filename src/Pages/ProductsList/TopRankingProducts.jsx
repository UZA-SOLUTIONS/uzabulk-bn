import React, { useEffect, useState } from "react";
import { Row, Col, Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";

import { APP_NAME } from "../../config/constants";
import { handlePageClick } from "../../helpers/commonHelper";
import { apiGetProductDetail, apiGetTopRankingProducts } from "../../store/products/actions";
import ProductsListingInfinite from "../../Components/Products/ProductsListingInfinite";

const TopRankingProducts = () => {
  let [searchParams] = useSearchParams();

  const dispatch = useDispatch();
  const { currentCurrency } = useSelector(s => s.config);
  const { detail } = useSelector((s) => s.products.productDetail);
  const { isLoading, items, hasMore, message, skip } = useSelector((s) => s.products.topRankingProducts);

  const limit = 32;

  const fetchRecords = (init = false) => {
    dispatch(
      apiGetTopRankingProducts({
        limit: limit,
        skip: init ? 1 : skip + 1,
        category: searchParams.get("category"),
        search: searchParams.get("search"),
      })
    );
  }

  useEffect(() => {
    fetchRecords(true);
  }, [searchParams]);
  // }, [searchParams, currentCurrency?.code]);

  useEffect(() => {
    const topIds = searchParams.get("topIds");
    if (topIds) {
      dispatch(apiGetProductDetail({ id: topIds }));
    }
  }, [dispatch, searchParams]);

  return (
    <div className="wrapList">
      <Helmet>
        <title>{APP_NAME} | Shop</title>
      </Helmet>
      <Container fluid>
        <Row>
          {/* <Col lg={3}>
            <Sidefilleter />
          </Col> */}

          <Col lg={12}>
            <h5 className="all_product_head text-start mb-4">
              Top Ranking Products
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

export default TopRankingProducts;
