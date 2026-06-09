import React, { useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { apiGetHomeProducts } from "../../store/products/actions";
import ROUTES from "../../helpers/routesHelper";
import { amountConversion, getProductImageUrl } from "../../helpers/commonHelper";
import placeholder from "../../assets/images/gurfive.jpg";

const AllCategoriesProductsGrid = ({ withContainer = true }) => {
  const dispatch = useDispatch();
  const { isLoading, items, message } = useSelector((s) => s.products.homeProducts);
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);

  useEffect(() => {
    if (!items?.length) {
      dispatch(
        apiGetHomeProducts({
          limit: 24,
          skip: 1,
        })
      );
    }
  }, [dispatch, items?.length]);

  const content = (
    <>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h4 className="m-0 text-start">You might also like</h4>
        <Link to={ROUTES.PRODUCT_LISTING}>View More</Link>
      </div>

      <Row className="g-3 products_compact_row">
        {(items || []).slice(0, 24).map((item) => {
          const fallbackOfferId = item?.offerId || item?.topIds || "";
          const resolvedId = item?._id || item?.id || item?.productId || fallbackOfferId;
          const productLink = resolvedId
            ? `${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(resolvedId)}${fallbackOfferId ? `?offerId=${encodeURIComponent(fallbackOfferId)}` : ""}`
            : "#";
          return (
          <Col xl={2} lg={3} md={4} sm={6} xs={6} key={item._id || resolvedId}>
            <Link
              to={productLink}
              className="card_comnon-product cursor-pointer h-100 d-block"
              style={{ textDecoration: "none", color: "black", pointerEvents: resolvedId ? "auto" : "none", opacity: resolvedId ? 1 : 0.6 }}
            >
              <div className="card_item_Show position-relative">
                <img
                  src={getProductImageUrl(item, placeholder)}
                  alt={item?.name || "Product"}
                  className="img-fluid"
                />
              </div>
              <div className="card_content_list">
                <div className="upper_head text-start w-100">
                  <h5>{item?.name}</h5>
                </div>
                <div className="products_ist d-flex justify-content-between align-items-center mt-3">
                  <p>
                    {currentCurrency?.symbol} {amountConversion(item?.price, appConfig)}
                  </p>
                </div>
              </div>
            </Link>
          </Col>
        )})}
      </Row>

      {!isLoading && !items?.length ? (
        <p className="text-start mt-3 mb-0">{message || "No products found."}</p>
      ) : null}
    </>
  );

  return (
    <section className="py-4 products_card products_card_compact">
      {withContainer ? <Container>{content}</Container> : content}
    </section>
  );
};

export default AllCategoriesProductsGrid;
