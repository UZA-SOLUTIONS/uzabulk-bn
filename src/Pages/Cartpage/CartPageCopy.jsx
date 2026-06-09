import React, { useEffect, useRef, useState } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Form, Input } from "reactstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { toast } from "react-toastify";

import { APP_NAME } from "../../config/constants";
import { getCheckoutErrorMessage, getCouponDiscount, isReadyToPlaceOrder, manageCartQuantity } from "../../helpers/cartHelper";
import ROUTES from "../../helpers/routesHelper";
import { fixedNumber, logger } from "../../helpers/commonHelper";

import LoadingContent from "../../Components/Common/LoadingContent";
import Addressslemod from "../../Components/Modals/Addressslemod";
import CouponModal from "../../Components/Modals/CouponModal";
import AddToCart from "../../Components/Common/AddToCart";
import BlockContent from "../../Components/Common/BlockContent";
import EmptyCart from "./EmptyCart";

import { apiDeleteCart, apiGetCartList, apiUpdateCart } from "../../store/cart/actions";
import { apiCheckout, apiPlaceOrder } from "../../store/order/actions";
import { removeOrderDetails } from "../../store/order/slice";
import { apiGetAddresses } from "../../store/address/actions";
import { clearSelectedCart, setSelectedCartList } from "../../store/cart/slice";

import placeholder from "../../assets/images/sousix.jpg";
import { ICON_ADDRESS_HOME, ICON_BUILDING, ICON_LOCATION } from "../../assets/svg";
import ICON_TRASH from "../../assets/images/icon-trash.svg";
import TempErrorMessage from "../../Components/Common/TempErrorMessage";

const Cartpage = () => {
  const dispatch = useDispatch();
  const { isLogin } = useSelector((s) => s.auth);
  const { selectedCartList, cartList, isLoading } = useSelector((s) => s.cart);
  const { orderDetails, message } = useSelector((s) => s.order);
  const loadingOrder = useSelector((s) => s.order.isLoading);
  const shippingAddress = useSelector((s) => s.address.shippingAddress.detail);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);

  const checkoutBoxkRef = useRef();
  const selectAllRef = useRef(null);

  const navigate = useNavigate();

  const handleSelectAll = (e) => {
    if (e.target.checked) dispatch(setSelectedCartList(cartList.map((c) => c._id)));
    else dispatch(setSelectedCartList([]));
  };

  const handleOptionChange = (e, id) => {
    if (e.target.checked) {
      dispatch(setSelectedCartList([...selectedCartList, id]));
    } else {
      dispatch(setSelectedCartList(selectedCartList.filter((prevId) => prevId !== id)));
    }
  };

  const handleCheckout = (
    coupon = null,
    callback = (res) => {
      logger(res)
    }
  ) => {

    if (isLogin && !shippingAddress?._id) {
      toast.error("Please add shipping address.");
      return;
    }

    let data = {
      cart_ids: selectedCartList,
      shipping_address: shippingAddress?._id,
    };
    if (!!coupon) data.coupon = coupon;

    dispatch(
      apiCheckout({
        data,
        callback,
      })
    );
  };

  useEffect(() => {
    dispatch(apiGetCartList({}));
    if (isLogin) {
      dispatch(
        apiGetAddresses({
          limit: 100,
          skip: 0,
        })
      );
    }
  }, [dispatch, isLogin]);

  useEffect(() => {
    return () => {
      dispatch(clearSelectedCart());
    };
  }, [dispatch]);

  useEffect(() => {
    if (selectAllRef.current) {
      if (selectedCartList.length === 0) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = false;
      } else if (selectedCartList.length === cartList.length) {
        selectAllRef.current.indeterminate = false;
        selectAllRef.current.checked = true;
      } else {
        selectAllRef.current.indeterminate = true;
      }
    }
  }, [selectedCartList, selectAllRef]);

  useEffect(() => {
    if (selectedCartList.length) {
      if (isLogin && !shippingAddress?._id) {
        toast.error("Please add shipping address.");
      } else {
        handleCheckout();
      }
    } else {
      dispatch(removeOrderDetails());
    }
  }, [selectedCartList, isLogin, shippingAddress?._id, dispatch]);
  return (
    <section className="cart_view">
      <Addressslemod
        show={showAddressModal}
        onhide={() => setShowAddressModal(false)}
      />
      <CouponModal
        show={showCouponModal}
        onhide={() => setShowCouponModal(false)}
        handleCheckout={handleCheckout}
        coupon={orderDetails?.coupon}
      />
      <Helmet>
        <title>{APP_NAME} | Cart</title>
      </Helmet>
      <Container>
        <Row>
          <Col lg="12" className="text-start">
            <h2 className="fw-bold mt-0 mb-4">Shopping cart</h2>
          </Col>
        </Row>
        {cartList?.length ? (
          <Row>
            <Col lg="12" className="text-start">
              <h4 className="selecct_all_items">
                <input
                  type="checkbox"
                  className="form-check-input me-3 mt-0"
                  ref={selectAllRef}
                  onChange={handleSelectAll}
                />{" "}
                Select all items
              </h4>
            </Col>
            <Col lg={8} md={6} sm={12} key={selectedCartList?.length || 0}>
              {cartList.map((cart, index) => (
                <Row key={index} className="position-relative overflow-hidden">
                  {cart?.isLoading && <BlockContent />}
                  <Col lg="12" id={cart._id}>
                    <div className="d-flex justify-content-between">
                      <div>
                        <h5 className={"text-start mt-3 mb-0"}>
                          <Input
                            type="checkbox"
                            className="me-4 mt-0"
                            checked={selectedCartList.includes(cart._id)}
                            onChange={(e) => handleOptionChange(e, cart._id)}
                          />
                          {cart.product.name}
                        </h5>
                        <p className="text-danger text-start mb-0" style={{ marginLeft: '40px' }}>{getCheckoutErrorMessage({ cart, orderDetails, index })}</p>
                      </div>
                      <div className="d-flex align-items-center">
                        <Button className="trash-button"
                          onClick={() =>
                            dispatch(apiDeleteCart(cart._id))
                          }><img width={20} height={20} src={ICON_TRASH} /></Button>
                      </div>
                    </div>
                  </Col>
                  <Col lg={12}>
                    <div className="catpage_preview text-start pe-0 pe-lg-4">
                      {cart?.items?.map((item, idx) => {
                        return (
                          <>

                            {item?.message && <TempErrorMessage
                              message={item?.message}
                            />}

                            <div className="productd_wrap" key={idx}>
                              <div className="productimmg_side">
                                <div className="product_img me-lg-4 me-3">
                                  <img
                                    src={
                                      cart?.product?.featured_image?.link ||
                                      placeholder
                                    }
                                    alt=""
                                    className="img-fluid cursor-pointer"
                                    onClick={() => {
                                      navigate(
                                        ROUTES.PRODUCT_DETAIL +
                                        "/" +
                                        cart?.product?._id
                                      );
                                    }}
                                  />
                                </div>
                                <div className="product_Content">
                                  <h3 className="mb-0 mb-lg-4">
                                    {cart.product.name}
                                    <p className="text-success">
                                      {getCouponDiscount({
                                        orderDetails,
                                        cart,
                                        cartItem: item,
                                      })}
                                    </p>
                                  </h3>
                                  {item?.attributes?.map((attribute) => (
                                    <p>
                                      {attribute.attrName}. {attribute.attrValue}
                                    </p>
                                  ))}
                                </div>
                              </div>
                              <div className="price_quantity">
                                <div className="comon_setting">
                                  <p>
                                    <strong>Price</strong>
                                  </p>
                                  <p>
                                    <strong>${item.unitPrice}</strong>
                                  </p>
                                </div>

                                <div className="comon_setting">
                                  <p>
                                    <strong>Quantity</strong>
                                  </p>

                                  <div className="counter_div d-flex align-items-center gap-2 flex-column">
                                    <div className="d-flex gap-2">
                                      <AddToCart
                                        value={item.quantity}
                                        min={0}
                                        onChange={(value) => {
                                          manageCartQuantity({
                                            cartList,
                                            cartListIndex: index,
                                            cart,
                                            cartIndex: idx,
                                            dispatch,
                                            increase: true,
                                            setValue: Math.max(
                                              parseInt(value),
                                              0
                                            ),
                                          });
                                        }}
                                        onDecrement={() =>
                                          manageCartQuantity({
                                            cartList,
                                            cartListIndex: index,
                                            cart,
                                            cartIndex: idx,
                                            dispatch,
                                            increase: false,
                                          })
                                        }
                                        onIncrement={() => {
                                          manageCartQuantity({
                                            cartList,
                                            cartListIndex: index,
                                            cart,
                                            cartIndex: idx,
                                            dispatch,
                                            increase: true,
                                          });
                                        }}
                                      />

                                      <Button className="trash-button"
                                        onClick={() =>
                                          dispatch(
                                            apiUpdateCart({
                                              id: cart._id,
                                              data: {
                                                operateType: "MANUAL_DELETED",
                                                items: [
                                                  {
                                                    _id: item._id,
                                                  },
                                                ],
                                              },
                                            })
                                          )
                                        }>
                                        <img width={20} height={20} src={ICON_TRASH} />
                                      </Button>
                                    </div>

                                  </div>
                                </div>

                                <div className="comon_setting">
                                  <p>
                                    <strong>Total Price</strong>
                                  </p>
                                  <p>
                                    <strong>${fixedNumber(item.amount)}</strong>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })}
                    </div>
                  </Col>
                </Row>
              ))}
            </Col>

            <Col lg={4} md={6} sm={12}>
              {logger("checkoutBoxkRef.current?.offsetHeight", checkoutBoxkRef.current?.offsetHeight)}
              <div
                className="calculating_shiiping"
                style={{
                  position: "sticky",
                  top: "30px",
                }}
                ref={checkoutBoxkRef}
              >
                <h5>Calculated Shipping</h5>
                <Form>
                  {isLogin && <>
                    <div className="addrees_card border rounded p-3 text-start">
                      <div className="address_header d-flex align-items-center justify-content-between">
                        <h5>
                          <b>Delivery Address</b>
                        </h5>
                        {!!shippingAddress ? (
                          <Link
                            to="#"
                            className="change"
                            onClick={() => setShowAddressModal(true)}
                          >
                            Change
                          </Link>
                        ) : (
                          ""
                        )}
                      </div>

                      {!!shippingAddress ? (
                        <div className="address_show d-flex align-items-start mt-3">
                          <div className="icon_home d-flex align-items-center justify-content-center me-2 border">
                            {shippingAddress?.addressType === "home"
                              ? ICON_ADDRESS_HOME
                              : shippingAddress?.addressType === "office"
                                ? ICON_BUILDING
                                : ICON_LOCATION}
                          </div>
                          <div className="adreesText text-start">
                            <p>{shippingAddress?.name}</p>
                            <p>
                              {shippingAddress?.area}, {shippingAddress?.houseNo},{" "}
                              {shippingAddress?.landmark},{" "}
                              {shippingAddress?.address}
                            </p>
                          </div>
                        </div>
                      ) : (
                        ""
                      )}

                      <Button
                        className="add_address mt-3"
                        onClick={() => navigate(ROUTES.CREATE_ADDRESS)}
                      >
                        + Add Address
                      </Button>
                    </div>
                    {/* <Row>
                    <Col lg={12}>
                      <FormGroup>
                        <CountrySelect
                          onChange={(e) => {
                            logger(e);
                            setCountryid(e.id);
                          }}
                          placeHolder="Country"
                        />
                      </FormGroup>
                    </Col>

                    <Col lg={6} md={12}>
                      <FormGroup>
                        <StateSelect
                          countryid={countryid}
                          onChange={(e) => {
                            setstateid(e.id);
                          }}
                          placeHolder="State/City"
                        />
                      </FormGroup>
                    </Col>

                    <Col lg={6} md={12}>
                      <FormGroup>
                        <Input
                          type="text"
                          name="zipcode"
                          id="zipcode"
                          placeholder="Zipcode"
                        />
                      </FormGroup>
                    </Col>

                    <div className="px-2.5">
                      <Button className="update_btn w-100">Update</Button>
                    </div>
                  </Row> */}

                    <hr />
                  </>}

                  {/* <div className="coupt_code text-start">
                    <h5>Coupon Code</h5>
                    <p>
                      Lorem ipsum dolor sit, amet consectetur adipisicing elit.
                      Laudantium, architecto? adipisicing elit. Laudantium,
                      architecto?
                    </p>

                    <Col lg={12}>
                      <FormGroup>
                        <Input
                          type="number"
                          name="couponcode"
                          id="couponcode"
                          placeholder="Coupon Code"
                        />
                      </FormGroup>
                    </Col>

                    <div className="px-2.5">
                      <Button className="update_btn w-100">Update</Button>
                    </div>
                  </div> */}

                  <div className="car_total mt-3 text-start position-relative overflow-hidden">
                    {loadingOrder && <BlockContent />}
                    <h5>Price details</h5>
                    <p className="text-danger">{message}</p>
                    <ul className="p-0">
                      <li>
                        <p>Sub Amount</p>
                        <p>${fixedNumber(orderDetails?.subTotal || 0)}</p>
                      </li>
                      {orderDetails && (
                        <>
                          <li>
                            <p>Tax Amount</p>
                            <p>${fixedNumber(orderDetails?.tax || 0)}</p>
                          </li>
                          <li>
                            <p>Coupon discount</p>
                            <p
                              className={!orderDetails?.coupon ? "" : "text-success"}
                            >
                              {!orderDetails?.coupon ? (
                                <Button
                                  disabled={!isReadyToPlaceOrder(orderDetails)}
                                  className="apply_coupon"
                                  onClick={() => setShowCouponModal(true)}
                                >
                                  Apply coupon
                                </Button>
                              ) : (
                                "$" + fixedNumber(orderDetails.couponAmount)
                              )}
                            </p>
                          </li>
                          <li>
                            <p>Delivery Fee</p>
                            <p
                              className={
                                !(orderDetails?.deliveryFee || 0)
                                  ? "text-success"
                                  : ""
                              }
                            >
                              {!orderDetails?.deliveryFee
                                ? "Free"
                                : "$" +
                                fixedNumber(orderDetails?.deliveryFee || 0)}
                            </p>
                          </li>
                        </>
                      )}
                      <li>
                        <p className="fs-5 fw-medium mt-3">Total Amount</p>
                        <p className="fs-5 fw-medium mt-3">
                          ${fixedNumber(orderDetails?.orderTotal || 0)}
                        </p>
                      </li>
                    </ul>

                    <div className="px-2.5">
                      <Button
                        className="apply_btn w-100"
                        disabled={isLogin && !isReadyToPlaceOrder(orderDetails)}
                        onClick={() => {
                          if (isLogin) {
                            if (!shippingAddress?._id) {
                              toast.error("Please add shipping address.");
                              return;
                            }
                            const data = {
                              cart_ids: selectedCartList,
                              shipping_address: shippingAddress?._id,
                            };
                            if (orderDetails?.coupon) {
                              data.coupon = orderDetails.coupon;
                            }
                            dispatch(
                              apiPlaceOrder({
                                data,
                                callback: () => {
                                  navigate(ROUTES.CONGRATULATION);
                                },
                              })
                            );
                          }
                          else {
                            navigate(`${ROUTES.HOME}?auth=signin`);
                          }
                        }}
                      >
                        {isLogin ? "Place Order" : "Login to place order"}
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            </Col>
          </Row>
        ) : isLoading ? (
          <LoadingContent />
        ) : (
          <EmptyCart />
        )}
      </Container>
    </section>
  );
};

export default Cartpage;

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

const addresshome = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 24 24"
  >
    <path
      fill="#F6A532"
      d="m12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81zM12 3L2 12h3v8h6v-6h2v6h6v-8h3z"
    />
  </svg>
);
