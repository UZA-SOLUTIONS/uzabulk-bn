import React, { useEffect, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import Slider from "react-slick";
import { useDispatch, useSelector } from "react-redux";

import { getProductImageUrl, smoothScrollToTop, logger } from "../../helpers/commonHelper";
import ROUTES from "../../helpers/routesHelper";
import { apiGetHomeTopRankingProducts } from "../../store/products/actions";
import placeholder from "../../assets/images/Furniture.webp";
import Spinner from "../Spinner"; // Import the Spinner component

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    <div className={className} style={{ ...style }} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        viewBox="0 0 24 24"
      >
        <path
          fill="#000"
          d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887t.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75t-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1t-.375-.888t.375-.887z"
        />
      </svg>
    </div>
  );
}

function SamplePrevArrow(props) {
  const { className, style, onClick } = props;
  return (
    <div className={className} style={{ ...style }} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        viewBox="0 0 24 24"
      >
        <path
          fill="#000"
          d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"
        />
      </svg>
    </div>
  );
}

export default function TopRankingProducts() {
  const dispatch = useDispatch();
  const { isLoading, items } = useSelector(
    (s) => s.products.homeTopRankingProducts
  );
  logger("TOP RANKING PRODUCT SLIDER", items);
  const limit = 15;
  const navigate = useNavigate();

  useEffect(() => {
    if (!items?.length)
      dispatch(
        apiGetHomeTopRankingProducts({
          limit: limit,
        })
      );
  }, [dispatch]);

  const settings = {
    dots: false,
    arrows: true,
    infinite: true,
    speed: 500,
    autoplay: false,
    slidesToShow: 1,
    slidesToScroll: 1,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />,
  };

  // Create a fallback component for Suspense
  const LoadingFallback = () => (
    <div className="discover_card px-3">
      <div className="card_top_head d-flex align-items-center justify-content-between">
        <h4>Top Ranking</h4>
        <Link to={ROUTES.TOP_RANKING_PRODUCT_LISTING}>View More</Link>
      </div>
      <div className="card_white mt-3">
        <div className="most_popular_slider mt-2">
          <div className="d-flex justify-content-center align-items-center">
            <Spinner />
          </div>
        </div>
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
        <div className="discover_card px-3">
          <div className="card_top_head d-flex align-items-center justify-content-between">
            <h4>Top Ranking</h4>
            <Link to={ROUTES.TOP_RANKING_PRODUCT_LISTING}>View More</Link>
          </div>

          <div className="card_white mt-3">
            <div className="most_popular_slider mt-2">
              <Slider {...settings}>
                {items?.map((item, idx) => {
                  if (idx <= 5)
                    return (
                      <div
                        className="cardImg position-relative cursor-pointer"
                        key={idx}
                        onClick={() => {
                          smoothScrollToTop();
                          navigate(
                            ROUTES.TOP_RANKING_PRODUCT_LISTING +
                            "?topIds=" +
                            item._id
                          );
                        }}
                      >
                        <div className="most_popular text-start">
                          <h6>Most Popular</h6>
                          <p className="" style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 3,
                            overflow: "hidden",
                            textOverflow: "ellipsis", // Optional: Adds an ellipsis for overflow
                          }}>{item.name}</p>
                        </div>

                        <div className="car_bag position-relative"
                          style={{ height: 200 }}
                        >
                          <span className="Popular_bagde">
                            Popular score : {item.average_rating}
                          </span>
                          <img
                            src={getProductImageUrl(item, placeholder)}
                            alt=""
                            className="img-fluid object-fit-cover h-100"
                          />
                        </div>
                      </div>
                    );
                  return null;
                })}
              </Slider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
