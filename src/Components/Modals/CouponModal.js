import React from "react";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { Modal, Button, InputGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { logger } from "../../helpers/commonHelper";

const CouponModal = (props) => {
  const initialValues = { coupon: "" };
  const validationSchema = Yup.object().shape({
    coupon: Yup.string()
      .required("Coupon is a required field")
      .min(3, "Coupon must be at least 3 characters"),
  });
  return (
    <Modal
      {...props}
      size="md"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      <Modal.Header className="position-relative d-flex align-items-center justify-content-between">
        <Modal.Title id="contained-modal-title-vcenter">
          Apply Coupon
        </Modal.Title>
        <Link to="#" onClick={props.onhide}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
          >
            <path
              fill="#000"
              d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"
            />
          </svg>
        </Link>
      </Modal.Header>
      <Modal.Body>
        <Formik
          initialValues={initialValues}
          onSubmit={(data) => {
            props.handleCheckout(data.coupon, (res) => {
              logger(res.data);
              if (res.status === "success") {
                toast.success("Coupon applied successfully.");
                props.onhide();
              }
            });
          }}
          validationSchema={validationSchema}
        >
          {(form) => {
            return (
              <Form>
                <InputGroup className="mb-3">
                  <Field
                    className="form-control input-shadow"
                    placeholder="Enter coupon code"
                    name="coupon"
                    aria-describedby="basic-addon2"
                  />
                  <Button
                    type="submit"
                    disabled={form.values.coupon.length === 0 || !form.isValid}
                    className="track_order"
                  >
                    Apply
                  </Button>
                </InputGroup>

                <ErrorMessage
                  component={"p"}
                  name="coupon"
                  className="text-danger"
                />

              </Form>
            );
          }}
        </Formik>
      </Modal.Body>
    </Modal>
  );
};

export default CouponModal;
