import React from "react";
import { Link } from "react-router-dom";
import { Button, FormGroup } from "reactstrap";
import { Formik, Form } from "formik";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import * as Yup from "yup";

import ROUTES from "../../helpers/routesHelper";
import { apiForgotPassword } from "../../store/auth/actions";
import { ICON_USER } from "../../assets/svg";
import MobileNumberField, { MobileError } from "../../Components/Common/MobileNumberField";

export default function SendOtpComponent({ setMobileOtpSent }) {
  const dispatch = useDispatch();

  const initialValues = {
    mobileNumber: "",
    countryCode: "",
  };

  const validationSchema = Yup.object().shape({
    mobileNumber: Yup.string()
      .matches(/^\d+$/, "Mobile number must contain only digits")
      .min(10, "Mobile number must be at least 10 digits long")
      .required("Mobile number is required"),
    countryCode: Yup.string()
      .matches(
        /^\+\d+$/,
        "Country code must start with a '+' and contain only digits"
      )
      .required("Country code is required"),
  });

  const onSubmit = (data, form) => {
    dispatch(
      apiForgotPassword({
        data,
        callback: (res) => {
          toast.success(res.message);
          setMobileOtpSent(true);
        },
      })
    );
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
    >
      {(form) => {
        return (
          <Form>
            <FormGroup className="position-relative signupinput_phone mb-3">
              <label htmlFor="mobileNumber">Mobile number</label>
              <div
                className="d-flex align-items-center inputWithBtn iconWithText position-relative ps-5"
                style={{
                  background: "var(--theme-color)",
                  borderRadius: "15px",
                }}
              >
                <span className="icn position-absolute" style={{ left: 14 }}>
                  {ICON_USER}
                </span>
                <MobileNumberField
                  callback={(code, number) => {
                    form.setFieldValue("countryCode", code);
                    form.setFieldValue("mobileNumber", number);
                  }}
                />
              </div>
              <MobileError
                name="mobileNumber"
                value={form.values?.mobileNumber}
              />
            </FormGroup>

            <div className="create_account text-center">
              <p>
                <Link to={`${ROUTES.HOME}?auth=signin`}>BACK TO LOGIN</Link>
              </p>
            </div>

            <div className="mt-5">
              <Button className="auth_btn" type="submit">
                Send OTP
              </Button>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
}
