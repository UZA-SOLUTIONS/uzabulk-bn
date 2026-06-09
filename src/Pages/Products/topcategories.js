import React, { useEffect, useRef } from "react";
import Slider from "react-slick";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import ROUTES from "../../helpers/routesHelper";
import { smoothScrollToTop } from "../../helpers/commonHelper";
import { apiGetTopCategories } from "../../store/categories/actions";

import placeholder from "../../assets/images/Decor.webp";

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    <div className={className} style={{ ...style }} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
      >
        <path
          fill="#233448"
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
        width="28"
        height="28"
        viewBox="0 0 24 24"
      >
        <path
          fill="#233448"
          d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875t-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75t.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388t.375.875t-.375.875z"
        />
      </svg>
    </div>
  );
}

const Topcategories = () => {
  const dispatch = useDispatch();
  const { isLoading, data } = useSelector((s) => s.categories.topCategories);

  const navigate = useNavigate();

  const settings = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 8,
    slidesToScroll: 1,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        },
      },
    ],
  };

  useEffect(() => {
    dispatch(apiGetTopCategories({}));
  }, []);
  return (
    <section className="top_categories">
      <h4 className="black_heading_top text-start">Top categories</h4>

      <div className="innner_top_categories">
        <Slider {...settings}>
          {data?.map((value, index) => {
            return (
              <div
                className="text-center"
                key={index}
                onClick={() => {
                  navigate(ROUTES.PRODUCT_LISTING + "?skip=1&category=" + value._id);
                  smoothScrollToTop();
                }}
              >
                <div className="cate_img">
                  <img
                    src={value?.catImage?.link || placeholder}
                    alt=""
                    className="img-fluid"
                  />
                </div>
                <p className="categorie_name">{value.catName}</p>
              </div>
            );
          })}
        </Slider>
      </div>
    </section>
  );
};

export default Topcategories;
