import React, { useEffect, useMemo, useRef, useState } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Slider from "react-slick";
import { Helmet } from "react-helmet";
import { useDispatch, useSelector } from "react-redux";

import { ProductVariations } from "./ProductVariations";
import FeatureAttributes from "./FeatureAttributes";
import LoadingContent from "../../Components/Common/LoadingContent";
import NoRecordFound from "../../Components/Common/NoRecordFound";
import AddToCart from "../../Components/Common/AddToCart";

import { APP_NAME } from "../../config/constants";
import { addToCart, getProductInfo } from "../../helpers/cartHelper";
import { formatNumber, parseText } from "../../helpers/commonHelper";
import { openProductSupportChat } from "../../helpers/supportChatHelper";
import { apiGet } from "../../helpers/apiHelper";
import ROUTES from "../../helpers/routesHelper";
import { PRODUCTS } from "../../helpers/urlHelper";
import { apiGetProductDetail } from "../../store/products/actions";
import { manageProductForCart } from "../../store/products/slice";

import placeholder from "../../assets/images/sousix.jpg";
import SlideImage from "./SlideImage";
import ProductRating from "../../Components/Common/ProductRating";
import ProductReviews from "./ProductReviews";

/** 1688-style numeric offer id (length varies; avoid treating 24-hex Mongo ids as offer ids). */
const looksLike1688OfferId = (value) => {
  const s = String(value || "").trim();
  if (!/^\d+$/.test(s) || s.length < 4 || s.length > 30) return false;
  if (s.length === 24 && /^[a-fA-F0-9]{24}$/.test(s)) return false;
  return true;
};

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

const Singleview = () => {
  const dispatch = useDispatch();
  const { currentCurrency } = useSelector(s => s.config);
  const { isLoading, detail, message, outOfStock } = useSelector((s) => s.products.productDetail);
  const { isLogin } = useSelector(s => s.auth);
  const { cartData, price, stock, addedInCart } = useMemo(
    () => getProductInfo(detail),
    [detail]
  );

  const selectionKey =
    cartData.items?.[0]?.variation_id != null
      ? String(cartData.items[0].variation_id)
      : detail?._id
        ? `simple:${detail._id}`
        : "";

  const minQty = useMemo(() => {
    if (!detail) return 1;
    let moq;
    if (detail.variations?.length && cartData.items?.[0]?.variation_id) {
      const v = detail.variations.find((x) => x._id === cartData.items[0].variation_id);
      moq = v?.minQuantity ?? detail.minQuantity;
    } else {
      moq = detail.minQuantity;
    }
    const m = Number(moq);
    return Number.isFinite(m) && m > 0 ? Math.floor(m) : 1;
  }, [detail, cartData.items]);

  const maxQty = useMemo(() => {
    if (!stock?.instock) return 0;
    const q = stock.quantity;
    if (q == null || !Number.isFinite(q) || q === Infinity) return 999999;
    return Math.max(minQty, Math.floor(q));
  }, [stock?.instock, stock?.quantity, minQty]);

  const [addQty, setAddQty] = useState(1);

  useEffect(() => {
    setAddQty(minQty);
  }, [selectionKey, minQty]);

  const cartDataWithQty = useMemo(() => {
    if (!cartData?.items?.length) return cartData;
    return {
      ...cartData,
      items: cartData.items.map((item, idx) =>
        idx === 0 ? { ...item, quantity: addQty } : item
      ),
    };
  }, [cartData, addQty]);

  const componentRef = useRef(null);
  const [show, setShow] = useState(false);
  const [resolving1688OfferId, setResolving1688OfferId] = useState(false);
  const [offerLookupFailed, setOfferLookupFailed] = useState(false);

  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const normalizedId = String(id || "").trim();
  const fallbackQueryId = String(search.get("id") || search.get("topIds") || "").trim();
  const fallbackOfferId = String(search.get("offerId") || search.get("topIds") || "").trim();
  const resolvedProductId = /^[a-fA-F0-9]{24}$/.test(normalizedId)
    ? normalizedId
    : fallbackQueryId;
  const isValidProductId = /^[a-fA-F0-9]{24}$/.test(resolvedProductId);


  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    fade: true,
    autoplay: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />,
    appendDots: (dots) => (
      <div
        style={{
          backgroundColor: "#ddd",
          borderRadius: "10px",
          padding: "10px",
        }}
      >
        <ul style={{ margin: "0px" }}> {dots} </ul>
      </div>
    ),
    customPaging: (i) => (
      <div className="thumbnail_img">
        <img
          src={productImages[i] || placeholder}
          alt=""
          className="img-fluid"
        />
        <div className="elllispe_shape">
          <div className="ellispse_inner"></div>
        </div>
      </div>
    ),
  };

  const clampQty = (n) =>
    Math.min(Math.max(Number(n) || minQty, minQty), maxQty);

  const handlerAddToCart = () =>
    addedInCart
      ? navigate(ROUTES.CART)
      : addToCart({ cartData: cartDataWithQty, dispatch, isLogin });

  const handleProductChat = () => {
    if (!detail) return;
    openProductSupportChat({ detail, navigate });
  };

  const getProductImages = () => {
    let images = detail?.images?.length ? detail?.images?.map(img => img) : [detail?.featured_image]

    if (detail?.attributes?.length) {
      detail?.attributes?.forEach((attr) => {
        attr?.terms?.forEach((term) => {
          if (term.image) {
            images.push(term.image);
          }
        });
      });
    }
    return images;
  }

  useEffect(() => {
    if (isValidProductId) {
      dispatch(
        apiGetProductDetail({
          id: resolvedProductId,
          offerId: fallbackOfferId || undefined,
        })
      );
    }
  }, [resolvedProductId, isValidProductId, fallbackOfferId, dispatch]);

  useEffect(() => {
    setOfferLookupFailed(false);
  }, [normalizedId, search]);

  useEffect(() => {
    const tryResolve1688OfferId = async () => {
      if (isValidProductId) return;
      const fromQuery = String(
        search.get("offerId") || search.get("topIds") || ""
      ).trim();
      const candidate = looksLike1688OfferId(normalizedId)
        ? normalizedId
        : looksLike1688OfferId(fromQuery)
          ? fromQuery
          : "";
      if (!candidate) return;

      setResolving1688OfferId(true);
      setOfferLookupFailed(false);
      try {
        const res = await apiGet(`${PRODUCTS.BY_OFFER}/${encodeURIComponent(candidate)}`);
        if (res?.status === "success" && res?.data?._id && /^[a-fA-F0-9]{24}$/.test(res.data._id)) {
          const qs = search.toString();
          navigate(
            `${ROUTES.PRODUCT_DETAIL}/${res.data._id}${qs ? `?${qs}` : ""}`,
            { replace: true }
          );
        } else {
          setOfferLookupFailed(true);
        }
      } catch (error) {
        setOfferLookupFailed(true);
      } finally {
        setResolving1688OfferId(false);
      }
    };

    tryResolve1688OfferId();
  }, [isValidProductId, normalizedId, search, navigate]);

  useEffect(() => {
    const tryResolveFallbackOfferAfterDetailFailure = async () => {
      if (!isValidProductId || isLoading || detail) return;

      const offerCandidate = looksLike1688OfferId(fallbackOfferId)
        ? fallbackOfferId
        : looksLike1688OfferId(normalizedId)
          ? normalizedId
          : "";
      if (!offerCandidate) return;

      setResolving1688OfferId(true);
      try {
        const res = await apiGet(`${PRODUCTS.BY_OFFER}/${encodeURIComponent(offerCandidate)}`, {
          suppressGlobalErrorToast: true,
        });
        if (res?.status === "success" && res?.data?._id && /^[a-fA-F0-9]{24}$/.test(res.data._id)) {
          const qs = new URLSearchParams(search.toString());
          if (!qs.get("offerId") && !qs.get("topIds")) {
            qs.set("offerId", offerCandidate);
          }
          const qsText = qs.toString();
          navigate(
            `${ROUTES.PRODUCT_DETAIL}/${res.data._id}${qsText ? `?${qsText}` : ""}`,
            { replace: true }
          );
        } else {
          setOfferLookupFailed(true);
        }
      } catch (error) {
        setOfferLookupFailed(true);
      } finally {
        setResolving1688OfferId(false);
      }
    };

    tryResolveFallbackOfferAfterDetailFailure();
  }, [isValidProductId, isLoading, detail, fallbackOfferId, normalizedId, message, search, navigate]);

  useEffect(() => {
    const tryResolveInvalidId = async () => {
      if (isValidProductId || !normalizedId) return;
      if (looksLike1688OfferId(normalizedId)) return;

      try {
        const decodedSearch = decodeURIComponent(normalizedId);
        const res = await apiGet(PRODUCTS.LIST, { search: decodedSearch, limit: 1, skip: 1 });
        const firstItem = res?.data?.items?.[0];
        if (firstItem?._id && /^[a-fA-F0-9]{24}$/.test(firstItem._id)) {
          navigate(`${ROUTES.PRODUCT_DETAIL}/${firstItem._id}`, { replace: true });
        }
      } catch (error) {
      }
    };

    tryResolveInvalidId();
  }, [isValidProductId, normalizedId, navigate]);
  // }, [id, dispatch, currentCurrency?.code]);

  useEffect(() => {
    return () => {
      dispatch(manageProductForCart(null));
    };
  }, [dispatch]);

  useEffect(() => {
    if (outOfStock) {
      const redirectToken = search.get("redirectUrl");
      if (redirectToken) {
        componentRef.current = setTimeout(() => {
          try {
            window.location.href = atob(redirectToken);
          } catch (error) {
            // Keep user on the page if redirect token is invalid.
          }
        }, 3000);
      }
    }

    return () => {
      clearTimeout(componentRef.current);
    };
  }, [outOfStock, search]);

  const productImages = getProductImages(detail);
  return (
    <section className="single_view single_view--pdp my-4 my-lg-5" style={{ backgroundColor: "white" }}>
      <Helmet>
        <title>{APP_NAME} | Product details</title>
      </Helmet>
      <Container>
        {isLoading || resolving1688OfferId ? (
          <LoadingContent />
        ) : !isValidProductId ? (
          <NoRecordFound
            message={
              offerLookupFailed
                ? "No product in our catalog matches this supplier ID. Open an item from search or a listing, or use the product page link from the site."
                : "Invalid product link. Please open a product from the list."
            }
          />
        ) : detail ? (
          <>
            <Row className="g-4 align-items-start">
              <Helmet>
                <title>{APP_NAME} | {outOfStock ? "Out of stock" : `${detail?.name}`}</title>
              </Helmet>
              {outOfStock ? (
                <>
                  <NoRecordFound message={message} />
                </>
              ) : (
                <>
                  <Col lg={6} sm={12}>
                    <div className="product_preview text-start pe-0 pe-lg-4">
                      <h4 className="fs-5">{detail?.name || ""}</h4>
                      <div className="d-flex gap-3 flex-wrap align-items-center">
                        <p className="mb-0 d-flex flex-wrap align-items-center gap-2">
                          <ProductRating
                            rating={detail?.average_rating}
                            count={detail?.rating_count}
                            source={detail?.rating_source}
                          />
                          {detail?.sold_count ? (
                            <>
                              <span className="dot"></span>
                              <span>{detail.sold_count} sold</span>
                            </>
                          ) : null}
                        </p>
                        {/* {ENVIRONMENT === "development" && detail?.offerId ? <Link className="btn btn-sm rounded rounded-5" to={`https://detail.1688.com/offer/${detail?.offerId}.html`} target="_blank" style={{
                      height: "25px",
                      padding: "3px 10px",
                      background: "var(--theme-yellow)",
                      fontSize: "12px",
                      fontWeight: 500,
                      border: "1px solid var(--theme-color)",
                    }}>1688.com</Link> : ""} */}
                      </div>
                    </div>

                    <div className="sinlge_product_slider position-relative">
                      {/* {like ? (
                    <Button className="heart_btn" onClick={liked}>
                      {heartfill}
                    </Button>
                  ) : (
                    <Button className="heart_btn" onClick={liked}>
                      {heartline}
                    </Button>
                  )} */}

                      <Slider {...settings}>
                        {productImages?.map((link, imgIdx) => <SlideImage key={imgIdx} link={link} />)}
                      </Slider>
                    </div>
                  </Col>

                  <Col lg={6} sm={12}>
                    <div className="product_right_vcariant text-start py-3 py-lg-4 px-3 px-lg-4">
                      <ul className="p-0 d-flex align-items-center gap-5 flex-wrap">
                        <li>
                          <div className="same_content_single">
                            <h3>{currentCurrency?.symbol} {formatNumber(price)}</h3>
                          </div>
                        </li>
                      </ul>

                      <hr />

                      {detail?.variations?.length ? (
                        <ProductVariations
                          detail={detail}
                          show={show}
                          setShow={setShow}
                          handlerAddToCart={handlerAddToCart}
                        />
                      ) : (
                        ""
                      )}

                      {/* <hr />

                  <div className="shipping">
                    <p>
                      <strong>Electronic Express (Premium)</strong>
                      <Link to="">Change</Link>
                    </p>

                    <p>Shipping total : $230.52 for 20 pieces</p>
                    <p>
                      Estimated Delivery by <strong>Jul 15</strong>
                    </p>
                  </div> */}

                      <div className="button_three product-purchase-bar d-flex align-items-center justify-content-between gap-2 mt-4 flex-wrap">
                        {stock.instock ?
                          <>
                            <div className="product-purchase-primary d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2 flex-grow-1 min-w-0">
                              <div className="product-qty-block product-qty-block--inline">
                                <span className="product-qty-label">Qty</span>
                                <AddToCart
                                  variant="product"
                                  value={addQty}
                                  min={minQty}
                                  onDecrement={() => setAddQty((q) => clampQty(q - 1))}
                                  onIncrement={() => setAddQty((q) => clampQty(q + 1))}
                                  onChange={(raw) => {
                                    const n = Number.parseInt(String(raw), 10);
                                    if (Number.isNaN(n)) return;
                                    setAddQty(clampQty(n));
                                  }}
                                  disabled={addQty >= maxQty}
                                  decrementDisabled={addQty <= minQty}
                                />
                              </div>
                              <Button
                                className="addcart btn-product-addcart"
                                onClick={handlerAddToCart}
                              >
                                {addedInCart ? "Go to cart" : "Add to cart"}
                              </Button>
                            </div>
                            {/* <Button
                          className="Startbutton"
                          onClick={handlerAddToCart}
                        >
                          Start Order
                        </Button> */}
                          </> : <p className="out-of-stock">Out of stock</p>}
                        <Button
                          type="button"
                          className="chatbtn"
                          onClick={handleProductChat}
                          disabled={!detail}
                          aria-label="Chat with support about this product"
                          title="Contact support about this product"
                        >
                          {chaticon}
                        </Button>
                      </div>
                    </div>
                  </Col>
                </>
              )}
            </Row>


            <FeatureAttributes details={detail?.featureAttribute} />

            <div className="mx-auto px-0 px-sm-2" style={{ maxWidth: 900 }}>
              <ProductReviews reviews={detail?.reviews} />
            </div>

            {detail?.description ?
              <div className="product_description mx-auto px-0 px-sm-2" style={{ maxWidth: 900 }}>
                <Row className="text-start mt-5 ">
                  <Col lg="12">
                    <h3 className="pb-3">Product description</h3>
                  </Col>
                  <Col lg="12" className="uza-product-description" dangerouslySetInnerHTML={{ __html: parseText(detail?.description) }}>

                  </Col>
                </Row>
              </div>
              : null}
          </>
        ) : (
          <NoRecordFound message={message || "Product not found! Please open a product from the list."} />
        )}
      </Container>
    </section >
  );
};

export default Singleview;

// svg
const chaticon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 256 256"
  >
    <path
      fill="#000"
      d="M216 52H40a12 12 0 0 0-12 12v160a11.89 11.89 0 0 0 6.93 10.88A12.2 12.2 0 0 0 40 236a11.9 11.9 0 0 0 7.69-2.83L81.49 204H216a12 12 0 0 0 12-12V64a12 12 0 0 0-12-12m4 140a4 4 0 0 1-4 4H80a4 4 0 0 0-2.62 1l-34.82 30.06A4 4 0 0 1 36 224V64a4 4 0 0 1 4-4h176a4 4 0 0 1 4 4Zm-56-80a4 4 0 0 1-4 4H96a4 4 0 0 1 0-8h64a4 4 0 0 1 4 4m0 32a4 4 0 0 1-4 4H96a4 4 0 0 1 0-8h64a4 4 0 0 1 4 4"
    />
  </svg>
);

