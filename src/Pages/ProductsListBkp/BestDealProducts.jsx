import React, { useEffect, useState } from "react";
import { Row, Col, Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";

import ProductsListing from "../../Components/Products/ProductsListing";
import { APP_NAME } from "../../config/constants";
import { handlePageClick } from "../../helpers/commonHelper";
import { apiGetBestSalerProducts, apiGetProductDetail } from "../../store/products/actions";

const BestDealProducts = () => {
  let [searchParams] = useSearchParams();

  const dispatch = useDispatch();
  const { detail } = useSelector((s) => s.products.productDetail);
  const { isLoading, items, totalPages, message } = useSelector((s) => s.products.bestSalerProducts);

  const [skip, setSkip] = useState(1);
  const limit = 16;

  useEffect(() => {
    if (skip && searchParams) {
      dispatch(
        apiGetBestSalerProducts({
          limit: limit,
          skip: skip,
          category: searchParams.get("category"),
          search: searchParams.get("search"),
          fieldName: "bestSeller",
          fieldValue: true,
        })
      );
    }
  }, [skip, dispatch, searchParams]);

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
              Deals on Best Sellers
            </h5>
            <ProductsListing
              {...{
                items:
                  skip === 1 && detail
                    ? [
                      ...[
                        detail,
                        ...items?.filter((i) => i._id !== detail._id),
                      ],
                    ]
                    : items,
                handlePageClick: handlePageClick({ setSkip }),
                limit,
                totalPages,
                isLoading,
                message,
              }}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default BestDealProducts;
