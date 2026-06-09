import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormGroup, Label } from "reactstrap";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";

import { getCredentials, removeCredentials, saveCredentials } from "../../helpers/authHelper";
import { apiLogin } from "../../store/auth/actions";

import { ICON_USER } from "../../assets/svg";
import PasswordField from "../Common/PasswordField";
import ROUTES from "../../helpers/routesHelper";
import ButtonLoader from "../Common/ButtonLoader";

const Signin = ({ handleClose }) => {
  const dispatch = useDispatch();
  const isAuthLoading = useSelector((s) => s.auth.isLoading);
  const [initialValues, setInitialValues] = useState({
    password: "",
    email: "",
    rememberMe: false,
  });

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .email("Please enter a valid email")
      .required("Email is required"),
    password: Yup.string().required("Password is required"),
  });

  const onSubmit = async (data, form) => {
    try {
      await dispatch(
        apiLogin({
          data: {
            password: data.password,
            email: data.email,
          },
        })
      ).unwrap();
      if (data.rememberMe) {
        saveCredentials(data);
      } else {
        removeCredentials();
      }
      handleClose();
      toast.success("Login successful");
    } catch (e) {
      const msg = typeof e === "string" ? e : e?.message || "Login failed";
      toast.error(msg);
    } finally {
      form.setSubmitting(false);
    }
  };

  useEffect(() => {
    const credentials = getCredentials();
    if (credentials) {
      setInitialValues((s) => ({ ...s, ...credentials }));
    }
  }, []);
  return (
    <div className="auth_login_form position-relative">
      <div className="login_auth">
        <h4 className="mb-4">USER LOGIN</h4>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={onSubmit}
          enableReinitialize={true}
        >
          {(form) => {
            return (
              <Form>
                <FormGroup className="mb-3 auth-field-group">
                  <div className="auth-field">
                    <span className="auth-field__icon" aria-hidden>
                      {ICON_USER}
                    </span>
                    <Field
                      type="email"
                      name="email"
                      className="form-control auth-field__input"
                      placeholder="Enter your email"
                    />
                  </div>
                  {form.touched.email && form.errors.email ? (
                    <small className="text-danger">{form.errors.email}</small>
                  ) : null}
                </FormGroup>

                <PasswordField />

                <div className="remember_me d-flex align-items-center justify-content-between">
                  <FormGroup check>
                    <Label check>
                      <Field
                        type="checkbox"
                        name="rememberMe"
                        className="form-check-input"
                      />
                      Remember me
                    </Label>
                  </FormGroup>

                  <div className="forgot_pasword">
                    <Link to={ROUTES.FORGOT}>Forgot Password</Link>
                  </div>
                </div>

                <div className="mt-5">
                  <Button className="auth_btn" type="submit" disabled={form.isSubmitting || isAuthLoading}>
                    {form.isSubmitting || isAuthLoading ? <ButtonLoader /> : "Login"}
                  </Button>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </div>
  );
};

export default Signin;

// svg

const signinicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
  >
    <path
      fill="#F6A532"
      d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 6v-.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2v.8q0 .825-.587 1.413T18 20H6q-.825 0-1.412-.587T4 18m2 0h12v-.8q0-.275-.137-.5t-.363-.35q-1.35-.675-2.725-1.012T12 15t-2.775.338T6.5 16.35q-.225.125-.363.35T6 17.2zm6-8q.825 0 1.413-.587T14 8t-.587-1.412T12 6t-1.412.588T10 8t.588 1.413T12 10m0 8"
    ></path>
  </svg>
);
