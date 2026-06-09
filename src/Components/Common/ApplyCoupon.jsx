import React, { useDeferredValue, useEffect, useState } from "react";
import { Field, Form, Formik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { InputGroup } from "react-bootstrap";
import { toast } from "react-toastify";
import { Button } from "reactstrap";
import * as Yup from "yup";

import TempErrorMessage from "./TempErrorMessage";
import { fixedNumber, logger } from "../../helpers/commonHelper";
import { setCouponCode } from "../../store/cart/slice";
import { ICON_COUPON } from "../../assets/svg";
import { CURRENCY_SYMBOL } from "../../config/constants";

export function ApplyCoupon({ handleCheckout }) {
    const dispatch = useDispatch();
    const { orderDetails, message } = useSelector((s) => s.order);
    const initialValues = { coupon: "" };
    const [disabled, setDisabled] = useState(false);
    const [coupon, setCoupon] = useState("");
    const [key, setKey] = useState(0);
    const deffCoupon = useDeferredValue(coupon);
    const validationSchema = Yup.object().shape({
        coupon: Yup.string()
            .required("Coupon is a required field")
            .min(3, "Coupon must be at least 3 characters"),
    });

    useEffect(() => {
        setDisabled(false);
    }, [deffCoupon])
    return (
        <>
            <div className="text-start">
                <div className="fs-6 text-black-50 mb-2">{ICON_COUPON} Coupon</div>
                <div className="align-items-center d-flex gap-3 justify-content-between">
                    {orderDetails?.coupon ? (
                        <>
                            <div className="align-items-center d-flex gap-3">
                                <div style={{ lineHeight: '14px' }}>
                                    <p className="m-0 text-nowrap">Coupon applied</p>
                                    <span className="w-100 fs-xs text-success">You saved additional {CURRENCY_SYMBOL}{fixedNumber(orderDetails.couponAmount)}</span>
                                    <div className="checkout-coupon">{orderDetails.coupon}</div>
                                </div>
                            </div>
                            <Button className="btn-theme-primary fs-base py-1" onClick={() => {
                                handleCheckout("");
                            }}>Remove</Button>
                        </>
                    ) : <Formik
                        initialValues={initialValues}
                        onSubmit={(data, form) => {
                            setDisabled(true);
                            handleCheckout(data.coupon, (res) => {
                                logger(res.data);
                                if (res.status === "success" && !res.data?.couponError) {
                                    dispatch(setCouponCode(data.coupon));
                                    toast.success("Coupon applied successfully.");
                                    form.resetForm();
                                }
                                else {
                                    dispatch(setCouponCode());
                                }
                                setKey(k => k + 1);
                            });
                        }}
                        validationSchema={validationSchema}
                    >
                        {(form) => {
                            setCoupon(form.values.coupon);
                            return (
                                <Form className="w-100">
                                    <InputGroup>
                                        <Field
                                            className="form-control input-shadow"
                                            placeholder="Enter coupon code"
                                            name="coupon"
                                            aria-describedby="basic-addon2"
                                        />
                                        <Button
                                            type="submit"
                                            disabled={disabled || form.values.coupon.length === 0 || !form.isValid}
                                            className="btn-theme-secondary py-0"
                                        >
                                            Apply
                                        </Button>
                                    </InputGroup>
                                </Form>
                            );
                        }}
                    </Formik>}

                    {/* <Button className="btn-theme-primary fs-base py-1" onClick={() => setShowCouponModal(true)}>Apply</Button> */}
                </div>
                <TempErrorMessage
                    key={key}
                    message={orderDetails?.couponError}
                    delay={5000}
                    className="mb-3 mt-0 w-100 text-start"
                />
            </div>
        </>
    );
}