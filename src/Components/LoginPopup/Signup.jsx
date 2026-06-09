import React, { useMemo, useRef, useState } from "react";
import { Button, FormGroup } from "reactstrap";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";

import MobileNumberField, { MobileError } from "../Common/MobileNumberField";
import PasswordField from "../Common/PasswordField";
import { apiRegister, apiVerifyEmail, apiVerifyOtp } from "../../store/auth/actions";

import { ICON_EMAIL_OTP, ICON_RELOAD, ICON_USER } from "../../assets/svg";
import ResendOtp from "../Common/ResendOtp";
import ButtonLoader from "../Common/ButtonLoader";

const Signup = ({ handleClose }) => {
  const dispatch = useDispatch();
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  /** Formik can drop `emailOtp` when the field is hidden; backend still needs it on register. */
  const verifiedEmailOtpRef = useRef("");

  const initialValues = {
    email: "",
    password: "",
    confirmPassword: "",
    mobileNumber: "",
    countryCode: "+1",
    emailOtp: "",
  };

  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        email: Yup.string()
          .email("Invalid email format")
          .required("Email is required"),
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
        mobileNumber: Yup.string()
          .matches(/^\d+$/, "Mobile number must contain only digits")
          .min(8, "Enter a valid mobile number (at least 8 digits)")
          .max(15, "Mobile number is too long")
          .required("Mobile number is required"),
        countryCode: Yup.string()
          .matches(
            /^\+\d+$/,
            "Country code must start with a '+' and contain only digits"
          )
          .required("Country code is required"),
        emailOtp:
          emailOtpSent && !emailVerified
            ? Yup.string().required("Enter the code from your email")
            : Yup.string().nullable().notRequired(),
      }),
    [emailOtpSent, emailVerified]
  );

  const sendOtp = (data, api, callback) => {
    dispatch(
      api({
        data,
        callback: (res) => {
          callback(true);
          toast.success(res.message);
        },
      })
    );
  };

  const verifyOtp = (data, callback) => {
    dispatch(
      apiVerifyOtp({
        data,
        callback: (res) => {
          callback(true);
          toast.success(res.message);
        },
      })
    );
  };

  const onSubmit = async (data, form) => {
    if (!emailVerified) {
      toast.error("Email is not verified");
      form.setSubmitting(false);
      return;
    }

    const payload = {
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      emailOtp: String(data.emailOtp || verifiedEmailOtpRef.current || "").trim(),
      mobileNumber: data.mobileNumber,
      countryCode: data.countryCode,
    };

    try {
      await dispatch(apiRegister({ data: payload })).unwrap();
      handleClose();
      toast.success("Account created. You are signed in.");
    } catch (e) {
      const msg = typeof e === "string" ? e : e?.message || "Registration failed";
      toast.error(msg);
    } finally {
      form.setSubmitting(false);
    }
  };

  return (
    <div className="login_auth">
      <h4 className="mb-4">USER SIGNUP</h4>
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={onSubmit}
      >
        {(form) => {
          const sendToEmail = () => {
            sendOtp(
              {
                email: form.values.email,
              },
              apiVerifyEmail,
              setEmailOtpSent
            );
          };

          const v = form.values;
          const otpForRegister = String(
            v.emailOtp || verifiedEmailOtpRef.current || ""
          ).trim();
          const mob = String(v.mobileNumber || "").replace(/\D/g, "");
          const registerReady =
            emailVerified &&
            !form.isSubmitting &&
            Boolean(v.email?.trim()) &&
            Boolean(otpForRegister) &&
            Boolean(v.countryCode && /^\+\d+$/.test(v.countryCode)) &&
            Boolean(
              mob.length >= 8 &&
                mob.length <= 15 &&
                /^\d+$/.test(mob)
            ) &&
            Boolean(
              v.password &&
                v.password.length >= 6 &&
                /\d/.test(v.password) &&
                /[a-zA-Z]/.test(v.password)
            ) &&
            String(v.password || "").trim() === String(v.confirmPassword || "").trim();

          return (
            <Form>
              <FormGroup className="position-relative">
                {emailOtpSent ? (
                  <div className="postion-relative verify_input mb-3">
                    <div className="auth_icon">{ICON_USER}</div>
                    <div
                      className="retry-credentials"
                      onClick={() => {
                        form.setFieldValue("email", "");
                        form.setFieldValue("emailOtp", "");
                        verifiedEmailOtpRef.current = "";
                        setEmailOtpSent(false);
                        setEmailVerified(false);
                      }}
                    >
                      {ICON_RELOAD}
                    </div>
                    <p
                      style={{
                        width: "calc(100% - 50px)",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {form.values.email}
                    </p>
                  </div>
                ) : null}
                <div
                  className={
                    emailOtpSent
                      ? "d-none"
                      : "d-flex align-items-center inputWithBtn"
                  }
                >
                  <div className="position-relative inputWrp">
                    <Field
                      className="form-control send-otp-email"
                      name="email"
                      id="email"
                      placeholder="Email"
                    />
                    <div className="auth_icon">{usericon}</div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => sendToEmail()}
                    className="send-otp-btn"
                    disabled={!!form.errors?.email || !form.values.email}
                  >
                    Send OTP
                  </Button>
                </div>
                {!emailOtpSent ? (
                  <ErrorMessage
                    name="email"
                    component="p"
                    className="text-danger"
                  />
                ) : null}
              </FormGroup>

              <FormGroup className="position-relative">
                {emailOtpSent ? (
                  <>
                    <div
                      className={
                        emailVerified
                          ? "d-none"
                          : "d-flex align-items-center inputWithBtn"
                      }
                    >
                      <div className="position-relative inputWrp">
                        <Field
                          className="form-control send-otp-email"
                          name="emailOtp"
                          id="emailOtp"
                          placeholder="Enter Email OTP"
                        />
                        <div className="auth_icon">{ICON_EMAIL_OTP}</div>
                      </div>
                      <Button
                        type="button"
                        className="send-otp-btn"
                        onClick={() => {
                          const otpSnap = String(form.values.emailOtp || "").trim();
                          verifyOtp(
                            {
                              otp: otpSnap,
                              email: form.values.email,
                              type: "email",
                            },
                            () => {
                              verifiedEmailOtpRef.current = otpSnap;
                              form.setFieldValue("emailOtp", otpSnap);
                              setEmailVerified(true);
                            }
                          );
                        }}
                        disabled={
                          !!form.errors?.emailOtp || !form.values.emailOtp
                        }
                      >
                        Verify OTP
                      </Button>
                    </div>
                    {!emailVerified ? (
                      <ResendOtp callback={sendToEmail} />
                    ) : null}
                  </>
                ) : null}
              </FormGroup>

              <FormGroup className="mb-3 signupinput_phone auth-phone-field">
                <MobileNumberField
                  inputClass="form-control login-auth-phone-input"
                  placeholder="Phone number"
                  callback={(code, number) => {
                    form.setFieldValue("mobileNumber", number);
                    form.setFieldValue("countryCode", code);
                  }}
                />
                <MobileError value={form.values?.mobileNumber} />
              </FormGroup>

              <PasswordField className="mb-3" />
              <PasswordField
                className="mb-3"
                name="confirmPassword"
                placeholder="Confirm Password"
              />

              <div className="mt-5">
                <Button
                  className="auth_btn"
                  type="submit"
                  disabled={!registerReady}
                >
                  {form.isSubmitting ? <ButtonLoader /> : "Register"}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default Signup;

const usericon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
  >
    <path
      fill="#fff"
      d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
    />
  </svg>
);
