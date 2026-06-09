import React, { useEffect, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Slider from "react-slick";

import placeholder from "../../assets/images/default_name4.webp";
import { apiGetHomeBestSalerProducts } from "../../store/products/actions";
import ROUTES from "../../helpers/routesHelper";
import { smoothScrollToTop, logger } from "../../helpers/commonHelper";
import Spinner from "../Spinner"; // Import the Spinner component

export default function BestSalerProduct() {
  const dispatch = useDispatch();
  const { isLoading, items } = useSelector(
    (s) => s.products.homeBestSalerProducts
  );
  logger("Best saler product ::: ", items);
  const navigate = useNavigate();

  useEffect(() => {
    if (!items?.length)
      dispatch(
        apiGetHomeBestSalerProducts({
          limit: 10,
          fieldName: "bestSeller",
          fieldValue: true,
        })
      );
  }, [dispatch]);

  const settings = {
    dots: false,
    arrows: false,
    infinite: (items?.length || 0) > 1,
    speed: 700,
    autoplay: (items?.length || 0) > 1,
    autoplaySpeed: 2200,
    pauseOnHover: false,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  // Create a fallback component for Suspense
  const LoadingFallback = () => (
    <div className="card_white mt-3">
      <div className="most_popular text-start">
        <h6>Loading deals on best sellers...</h6>
      </div>
      <div className="deals_img_wrap d-flex justify-content-center align-items-center">
        <Spinner /> {/* Spinner to show while loading */}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoadingFallback />
      </Suspense>
    );
  }

  if (items?.length) {
    return (
      <div className="card_white mt-3">
        <div className="most_popular text-start">
          <h6>Deals on best sellers</h6>
        </div>
        <div className="most_popular_slider best-seller-slider mt-2">
          <Slider {...settings}>
            {(items || []).map((item, idx) => (
              <div key={item?._id || idx}>
                <div
                  className="deals_img position-relative mt-3 cursor-pointer"
                  onClick={() => {
                    navigate(`${ROUTES.BEST_DEAL_PRODUCT_LISTING}?topIds=${item._id}`);
                    smoothScrollToTop();
                  }}
                >
                  <span className="Popular_bagde">10% OFF</span>
                  <div className="deals_img_wrap">
                    <img
                      src={item?.featured_image || placeholder}
                      alt={item?.name || "Best seller product"}
                      className="img-fluid"
                    />
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    );
  }

  return null;
}
