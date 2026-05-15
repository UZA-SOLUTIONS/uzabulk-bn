import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useDispatch } from "react-redux";

import SendOtpComponent from "./SendOtpComponent";
import VerifyOtpComponent from "./VerifyOtpComponent";
import ResetPasswordComponent from "./ResetPasswordComponent";

import { APP_NAME, BRAND_LOGO_PNG } from "../../config/constants";
import ROUTES from "../../helpers/routesHelper";
import { clearForgotPasswordState } from "../../store/auth/slice";


const ForgotPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  useEffect(() => {
    return () => {
      dispatch(clearForgotPasswordState());
    };
  }, []);

  return (
    <section className="signin d-flex align-items-center">
      <Helmet>
        <title>{APP_NAME} | Forgot Password</title>
      </Helmet>
      <div className="welcome_side text-start position-relative">
        <div className="overlay_set"></div>
        <div className="inner_welcome">
          <Link to={ROUTES.HOME}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
            >
              <path
                fill="#fff"
                d="M10.589 12.5H15q.213 0 .356-.144t.144-.357t-.144-.356T15 11.5h-4.411l1.765-1.766q.14-.133.14-.34t-.14-.348t-.347-.14q-.208 0-.341.14l-2.389 2.389q-.242.242-.242.565t.242.566l2.389 2.388q.14.14.344.13q.204-.009.344-.15t.14-.347t-.14-.34zm1.414 8.5q-1.866 0-3.51-.708q-1.643-.709-2.859-1.924t-1.925-2.856T3 12.003t.709-3.51Q4.417 6.85 5.63 5.634t2.857-1.925T11.997 3t3.51.709q1.643.708 2.859 1.922t1.925 2.857t.709 3.509t-.708 3.51t-1.924 2.859t-2.856 1.925t-3.509.709"
              />
            </svg>
          </Link>
          <div
            className="logo_here cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img src={BRAND_LOGO_PNG} alt="" className="img-fluid" />
          </div>
          <h2>
            Welcome <br /> <span>To the website</span>
          </h2>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Eum
            obcaecati sed laudantium numquam at soluta quia aliquam adipisci
            itaque ipsum.
          </p>
        </div>
      </div>

      <div className="auth_login_form position-relative">
        <div className="login_auth">
          <h4 className="mb-4">
            {!mobileOtpSent
              ? "Forgot Password"
              : mobileOtpSent && !mobileVerified
                ? "OTP Verification"
                : "Reset Password"}
          </h4>

          {!mobileOtpSent ? (
            <SendOtpComponent setMobileOtpSent={setMobileOtpSent} />
          ) : mobileOtpSent && !mobileVerified ? (
            <VerifyOtpComponent setMobileVerified={setMobileVerified} />
          ) : (
            <ResetPasswordComponent />
          )}
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
