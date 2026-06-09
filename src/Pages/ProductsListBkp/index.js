import React, { useEffect } from "react";
import { Row, Col, Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";

import ProductsListing from "../../Components/Products/ProductsListing";
import { APP_NAME } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { smoothScrollToTop } from "../../helpers/commonHelper";
import { apiGetProductDetail, apiGetProducts } from "../../store/products/actions";

const ProductList = () => {
  let [searchParams] = useSearchParams();

  const dispatch = useDispatch();
  const { detail } = useSelector((s) => s.products.productDetail);
  const { isLoading, items, totalPages, message } = useSelector((s) => s.products.products);

  const limit = 16;
  const navigate = useNavigate();

  useEffect(() => {

    if (searchParams) {
      dispatch(
        apiGetProducts({
          limit: limit,
          skip: searchParams.get("skip") || 1,
          category: searchParams.get("category"),
          search: searchParams.get("search"),
        })
      );
    }
  }, [dispatch, searchParams]);

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
              All Product List
            </h5>
            <ProductsListing
              {...{
                items:
                  (searchParams.get('skip') || '1') === '1' && detail
                    ? [
                      ...[
                        detail,
                        ...items?.filter((i) => i._id !== detail._id),
                      ],
                    ]
                    : items,
                handlePageClick: (event) => {
                  searchParams.set("skip", event.selected + 1)
                  navigate(ROUTES.PRODUCT_LISTING + "?" + searchParams.toString());
                  smoothScrollToTop();
                },
                limit,
                totalPages,
                isLoading,
                initialPage: parseInt(searchParams.get('skip') || '1') - 1,
                message,
              }}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default ProductList;
