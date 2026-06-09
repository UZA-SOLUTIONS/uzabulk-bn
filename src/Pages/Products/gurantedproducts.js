import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import ROUTES from "../../helpers/routesHelper";
import { apiGetGuaranteedProducts } from "../../store/products/actions";

import placeholder from "../../assets/images/gurone.jpg";

const Gurantedproducts = () => {
  const dispatch = useDispatch();
  const { isLoading, items } = useSelector(
    (s) => s.products.guaranteedProducts
  );
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(apiGetGuaranteedProducts());
  }, []);
  return (
    <section className="guranted_products text-start my-4">
      <div className="text-start">
        <h4 className="cat_yeloow_head">Guaranted Products</h4>
        <p className="card_sub_head">
          Shipping included prices with guranted delivery{" "}
        </p>
      </div>

      <div className="guranted_box d-flex align-items-center gap-3 mt-3">
        {items?.map((item, idx) => {
          const fallbackOfferId = item?.offerId || item?.topIds || "";
          const resolvedId = item?._id || item?.id || item?.productId || fallbackOfferId;
          if (idx < 6)
            return (
              <div
                className="box_wrap"
                key={idx}
                onClick={() => {
                  if (!resolvedId) return;
                  navigate(`${ROUTES.PRODUCT_DETAIL}/${encodeURIComponent(resolvedId)}${fallbackOfferId ? `?offerId=${encodeURIComponent(fallbackOfferId)}` : ""}`);
                }}
              >
                <img
                  src={item?.featured_image?.link || placeholder}
                  alt=""
                  className="img-fluid"
                />
              </div>
            );
          return null;
        })}
      </div>
    </section>
  );
};

export default Gurantedproducts;
