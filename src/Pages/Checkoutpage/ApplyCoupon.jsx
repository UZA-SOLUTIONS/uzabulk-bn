import React, { useDeferredValue, useEffect, useState } from "react";
import { InputGroup } from "react-bootstrap";
import { Button } from "reactstrap";
import { logger } from "../../helpers/commonHelper";
import { ErrorMessage, Field, Form, Formik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";

export function ApplyCoupon({ handleCheckout }) {
    const initialValues = { coupon: "" };
    const [disabled, setDisabled] = useState(false);
    const [coupon, setCoupon] = useState("");
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
            <Formik
                initialValues={initialValues}
                onSubmit={(data, form) => {
                    setDisabled(true);
                    handleCheckout(data.coupon, (res) => {
                        logger(res.data);
                        if (res.status === "success" && !res.data?.couponError) {
                            toast.success("Coupon applied successfully.");
                            form.resetForm();
                        }
                    });
                }}
                validationSchema={validationSchema}
            >
                {(form) => {
                    setCoupon(form.values.coupon);
                    return (
                        <Form>
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
                                    className="track_order"
                                >
                                    Apply
                                </Button>
                            </InputGroup>

                            <ErrorMessage
                                component={"p"}
                                name="coupon"
                                className="text-danger text-start"
                            />
                        </Form>
                    );
                }}
            </Formik>
        </>
    );
}