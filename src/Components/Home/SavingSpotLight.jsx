import React, { useEffect, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Row, Col } from "react-bootstrap";

import ROUTES from "../../helpers/routesHelper";
import { amountConversion, getProductImageUrl, smoothScrollToTop, logger } from "../../helpers/commonHelper";
import { apiGetHomeSavingSpotlightProducts } from "../../store/products/actions";
import placeholder from "../../assets/images/Decor.webp";
import Spinner from "../Spinner"; // Import the Spinner component

export default function SavingSpotLight() {
  const dispatch = useDispatch();
  const { isLoading, items } = useSelector(
    (s) => s.products.homeSavingSpotlightProducts
  );
  const { currentCurrency } = useSelector((s) => s.config);
  const appConfig = useSelector((s) => s.config.data);
  logger("Saving spotlight products ::: ", items);
  const limit = 50;
  const navigate = useNavigate();

  useEffect(() => {
    if (!items?.length)
      dispatch(
        apiGetHomeSavingSpotlightProducts({
          limit: limit,
        })
      );
  }, [dispatch, items?.length]);

  // Create a fallback component for Suspense
  const LoadingFallback = () => (
    <div className="discover_card px-3 h-100 w-100">
      <div className="card_top_head d-flex align-items-center justify-content-between">
        <h4>Saving Spotlight</h4>
        <Link to={ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING}>View More</Link>
      </div>
      <div className="card_white mt-3">
        <Row className="g-3 align-items-start">
          <Col md={12}>
            <div className="d-flex justify-content-center align-items-center">
              <Spinner />
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );

  return (
    <>
      {isLoading ? (
        <Suspense fallback={<LoadingFallback />}>
          <LoadingFallback />
        </Suspense>
      ) : (
        <div className="discover_card px-3 h-100 w-100">
          <div className="card_top_head d-flex align-items-center justify-content-between">
            <h4>Saving Spotlight</h4>
            <Link to={ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING}>View More</Link>
          </div>
          {items?.length ? (
            <div className="card_white mt-3">
              <Row className="g-3 align-items-start">
                <Col md={12}>
                  <div className="lowest_price d-flex align-items-center">
                    <p className="mb-0">Lowest price in 180 days</p>
                  </div>
                  <div className="new_Arrivals new_Arrivals_many d-flex align-items-center flex-wrap gap-2 mt-3">
                    {(items || []).slice(0, 50).map((item, idx) => (
                      <div
                        className="new_arrival_img new_arrival_product_card cursor-pointer text-start"
                        key={item?._id || idx}
                        onClick={() => {
                          navigate(
                            `${ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING}?topIds=${item._id}`
                          );
                          smoothScrollToTop();
                        }}
                      >
                        <div className="new_arrival_media">
                          <img
                            src={getProductImageUrl(item, placeholder)}
                            alt={item?.name || "Saving spotlight product"}
                            className="img-fluid"
                          />
                        </div>
                        <div className="px-1 pt-2">
                          <p className="mb-1" style={{ fontSize: "12px", lineHeight: 1.3 }}>
                            {item?.name}
                          </p>
                          <p className="mb-0 fw-semibold" style={{ fontSize: "12px" }}>
                            {currentCurrency?.symbol} {amountConversion(item?.price, appConfig)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Col>
              </Row>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
