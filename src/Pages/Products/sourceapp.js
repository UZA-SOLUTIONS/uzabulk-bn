import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ROUTES from "../../helpers/routesHelper";
import { smoothScrollToTop } from "../../helpers/commonHelper";
import { apiGetSourceByApplication } from "../../store/categories/actions";

// images
import placeholder from "../../assets/images/souone.jpg";

const Sourceapp = () => {
  const dispatch = useDispatch();
  const { isLoading, data } = useSelector(
    (s) => s.categories.sourceByApplication
  );
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(apiGetSourceByApplication());
  }, []);
  return (
    <section className="Sourceapp_products text-start my-4">
      <div className="text-start">
        <h4 className="cat_yeloow_head">Source by Application</h4>
      </div>

      <div className="Sourceapp_box mt-3 d-flex align-items-center gap-3">
        {data?.map((value, idx) => {
          if (idx < 6)
            return (
              <div
                className="single_box text-center"
                key={idx}
                onClick={() => {
                  navigate(`${ROUTES.PRODUCT_LISTING}?skip=1&category=${value._id}`);
                  smoothScrollToTop();
                }}
              >
                <div className="Sourceapp_wrap">
                  <img
                    src={value?.catImage?.link || placeholder}
                    alt=""
                    className="img-fluid"
                  />
                </div>
                <div className="single_box_content">
                  <p>{value?.catName}</p>
                </div>
              </div>
            );
          return null;
        })}
      </div>
    </section>
  );
};

export default Sourceapp;
