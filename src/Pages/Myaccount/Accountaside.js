import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useParams } from "react-router-dom";

import LogoutPopup from "../../Components/Modals/LogoutPopup";
import ROUTES from "../../helpers/routesHelper";

import { apiLogout } from "../../store/auth/actions";
import { setCouponCode } from "../../store/cart/slice";

const Accountaside = () => {
  const { user, isLoading } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { id = "" } = useParams();

  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const handleLogout = () => {
    setShowLogoutPopup(false);
    dispatch(setCouponCode());
    dispatch(apiLogout());
  };

  return (
    <div className="sider_sidebar">
      <div className="header_details text-center">
        {/* <div className="profile_img">
          <img src={Profileimg} alt="" className="img-fluid" />
        </div> */}
        <h5>{user?.name || ""}</h5>
        <p>
          {phonecicon} {user?.countryCode || ""} {user?.mobileNumber || ""}
        </p>
      </div>

      <ul className="mt-5">
        <li>
          <Link
            to={ROUTES.MY_ORDERS}
            className={pathname === ROUTES.MY_ORDERS || pathname === `${ROUTES.ORDER_DETAIL}/${id}` ? "active" : ""}
          >
            My Orders
          </Link>
        </li>

        <li>
          <Link
            to={ROUTES.ORDER_ADDRESS}
            className={pathname === ROUTES.ORDER_ADDRESS ? "active" : ""}
          >
            My Address
          </Link>
        </li>

        <li>
          <Link
            to={ROUTES.PROFILE}
            className={pathname === ROUTES.PROFILE ? "active" : ""}
          >
            Profile
          </Link>
        </li>
        <li>
          <Link
            to={ROUTES.CHANGE_PASSWORD}
            className={pathname === ROUTES.CHANGE_PASSWORD ? "active" : ""}
          >
            Change Password
          </Link>
        </li>
        <li>
          <Link
            to="#"
            onClick={(event) => {
              event.preventDefault();
              setShowLogoutPopup(true);
            }}
          >
            Logout
          </Link>
          <LogoutPopup
            show={showLogoutPopup}
            onhide={() => setShowLogoutPopup(false)}
            onLogout={handleLogout}
            isLoggingOut={isLoading}
          />
        </li>
      </ul>
    </div>
  );
};

export default Accountaside;

// svg

const phonecicon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
  >
    <path
      fill="#F6A532"
      d="M19.95 21q-3.125 0-6.175-1.362t-5.55-3.863t-3.862-5.55T3 4.05q0-.45.3-.75t.75-.3H8.1q.35 0 .625.238t.325.562l.65 3.5q.05.4-.025.675T9.4 8.45L6.975 10.9q.5.925 1.187 1.787t1.513 1.663q.775.775 1.625 1.438T13.1 17l2.35-2.35q.225-.225.588-.337t.712-.063l3.45.7q.35.1.575.363T21 15.9v4.05q0 .45-.3.75t-.75.3"
    />
  </svg>
);
