import React from "react";
import { Link } from "react-router-dom";
import { Button } from "reactstrap";
import { useNavigate } from "react-router-dom";
import { Formik, Form } from "formik";
import { toast } from "react-toastify";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";

import PasswordField from "../../Components/Common/PasswordField";
import ROUTES from "../../helpers/routesHelper";
import {  apiResetPassword } from "../../store/auth/actions";

const ResetPasswordComponent = () => {
  const { forgotPassword } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const initialValues = {
    password: "",
    confirmPassword: "",
  };

  const validationSchema = Yup.object().shape({
    password: Yup.string()
      .required("Password is required")
      .test(
        "len",
        "Password must be at least 6 characters",
        (val) => val && val.length >= 6
      )
      .test("number", "Password must contain at least 1 number", (val) =>
        /\d/.test(val)
      )
      .test("letter", "Password must contain at least 1 letter", (val) =>
        /[a-zA-Z]/.test(val)
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm Password is required"),
  });

  const onSubmit = (data, form) => {
    dispatch(
      apiResetPassword({
        data: {
          password: data.password,
          confirmPassword: data.confirmPassword,
          currentPassword: data.currentPassword,
          mobileNumber: forgotPassword.mobileNumber,
          countryCode: forgotPassword.countryCode,
          otp: forgotPassword.otp,
        },
        callback: (res) => {
          toast.success(res.message);
          navigate(`${ROUTES.HOME}?auth=signin`);
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
            <PasswordField className="mb-3" />

            <PasswordField
              className="mb-3"
              name="confirmPassword"
              placeholder="Confirm Password"
            />

            <div className="create_account text-center">
              <p>
                <Link to={`${ROUTES.HOME}?auth=signin`}>BACK TO LOGIN</Link>
              </p>
            </div>

            <div className="mt-5">
              <Button className="auth_btn" type="submit">
                Reset password
              </Button>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default ResetPasswordComponent;
