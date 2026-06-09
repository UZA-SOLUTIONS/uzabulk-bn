import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiGet } from "../../helpers/apiHelper";
import {
  buildProductDetailUrl,
  buildProductDetailUrlFromResolved,
  getProductImageUrl,
  resolveCatalogProductId,
  smoothScrollToTop,
} from "../../helpers/commonHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import placeholder from "../../assets/images/default_name.webp";
import UXSkeleton from "../Common/UXSkeleton";

export default function SimilarProductsRow({
  productId,
  title = "Similar products",
  limit = 8,
  className = "",
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!productId) {
      setItems([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    apiGet(`${PRODUCTS.SIMILAR}/${productId}`, {
      limit,
      suppressGlobalErrorToast: true,
    })
      .then((res) => {
        if (cancelled) return;
        if (!res || res.status !== "success") {
          setItems([]);
          return;
        }
        const list = Array.isArray(res.data) ? res.data : [];
        setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, limit]);

  const openProduct = async (item) => {
    smoothScrollToTop();
    const resolved = await resolveCatalogProductId(item);
    const path = resolved
      ? buildProductDetailUrlFromResolved(resolved, {
          redirectUrl: btoa(window.location.href),
        })
      : buildProductDetailUrl(item, {
          redirectUrl: btoa(window.location.href),
        });
    if (path) navigate(path);
  };

  if (!productId) return null;
  if (!loading && !items.length) return null;

  return (
    <section
      className={`similar_products_row ${className}`.trim()}
      aria-label={title}
    >
      <div className="similar_products_row__head">
        <h3 className="similar_products_row__title">{title}</h3>
      </div>

      {loading ? (
        <UXSkeleton count={4} />
      ) : (
        <div className="similar_products_row__track">
          {items.map((item, idx) => (
            <button
              key={item?._id || item?.offerId || idx}
              type="button"
              className="similar_products_row__card"
              onClick={() => openProduct(item)}
            >
              <img
                src={getProductImageUrl(item, placeholder)}
                alt={item?.name || "Similar product"}
                loading="lazy"
              />
              <span className="similar_products_row__name">{item?.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
