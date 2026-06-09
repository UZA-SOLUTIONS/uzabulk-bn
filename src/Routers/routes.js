import React, { useEffect } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ROUTES from "../helpers/routesHelper";

// importing all the themes
import BaseTheme from "../Themes/BaseTheme";

import Pagenotfound from "../Pages/404page";
import Congrats from "../Pages/Congrats";
import Cartpage from "../Pages/Cartpage";
import Checkoutpage from "../Pages/Checkoutpage";
import MyOrdersPage from "../Pages/MyOrders";
import OrderDetailPage from "../Pages/OrderDetail";
import AddressPage from "../Pages/Address";
import AddAddressPage from "../Pages/AddAddress";
import ProfilePage from "../Pages/Profile";
import ChangePasswordPage from "../Pages/ChangePassword";
import ForgotPassword from "../Pages/ForgotPassword";
import Homepage from "../Pages/Home";
import Blog from "../Pages/Blog";
import ContactUs from "../Pages/ContactUs";
import PrivacyPolicy from "../Pages/PrivacyPolicy";
import TermsAndConditions from "../Pages/TermsAndConditions";
import ProductsList from "../Pages/ProductsList";
import TopRankingProducts from "../Pages/ProductsList/TopRankingProducts";
import NewArrivalProducts from "../Pages/ProductsList/NewArrivalProducts";
import SavingSpotlightProducts from "../Pages/ProductsList/SavingSpotlightProducts";
import BestDealProducts from "../Pages/ProductsList/BestDealProducts";
import Singleview from "../Pages/Singleview";
import Myaccount from "../Pages/Myaccount";
import AboutUs from "../Pages/AboutUs";
import { apiGetCurrencies } from "../store/config/actions";
import UploadSlip from "../Pages/UploadSlip";
import SeoManager from "../Components/Common/SeoManager";

export default function MyRouts() {
  const dispatch = useDispatch();
  const { isLogin } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(apiGetCurrencies());
  }, [dispatch]);

  return (
    <div>
      <BrowserRouter>
        <SeoManager />
        <Routes>
          <Route element={<BaseTheme />}>
            {isLogin ? (
              <>
                {/* Private routes */}
                <Route path={ROUTES.CONGRATULATION} element={<Congrats />} />

                <Route element={<Myaccount />}>
                  <Route path={ROUTES.MY_ORDERS} element={<MyOrdersPage />} />
                  <Route path={ROUTES.ORDER_DETAIL + "/:id"} element={<OrderDetailPage />} />
                  <Route path={ROUTES.ORDER_ADDRESS} element={<AddressPage />} />
                  <Route path={ROUTES.CREATE_ADDRESS + "/:id"} element={<AddAddressPage />} />
                  <Route path={ROUTES.CREATE_ADDRESS + "/"} element={<AddAddressPage />} />
                  <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
                  <Route path={ROUTES.CHANGE_PASSWORD} element={<ChangePasswordPage />} />
                </Route>

              </>
            ) : (
              <>
                <Route path={ROUTES.FORGOT} element={<ForgotPassword />} />
              </>
            )}

            <Route
              path={ROUTES.LOGIN}
              element={<Navigate to={`${ROUTES.HOME}?auth=signin`} replace />}
            />
            <Route
              path={ROUTES.SIGNUP}
              element={<Navigate to={`${ROUTES.HOME}?auth=signup`} replace />}
            />
            <Route
              path={ROUTES.MERCHANT_SIGNUP}
              element={<Navigate to={`${ROUTES.HOME}?auth=merchant-signup`} replace />}
            />
            <Route path={ROUTES.HOME} element={<Homepage />} />
            <Route path={ROUTES.BLOG} element={<Blog />} />
            <Route path={ROUTES.CONTACT_US} element={<ContactUs />} />
            <Route path={ROUTES.ABOUT_US} element={<AboutUs />} />
            <Route path={ROUTES.PRIVACY_POLICY} element={<PrivacyPolicy />} />
            <Route path={ROUTES.T_AND_C} element={<TermsAndConditions />} />
            <Route path={ROUTES.CATEGORIES} element={<ProductsList />} />
            <Route path={ROUTES.PRODUCT_LISTING} element={<ProductsList />} />
            <Route path={ROUTES.TOP_RANKING_PRODUCT_LISTING} element={<TopRankingProducts />} />
            <Route path={ROUTES.NEW_ARRIVALS_PRODUCT_LISTING} element={<NewArrivalProducts />} />
            <Route path={ROUTES.SAVING_SPOTLIGHT_PRODUCT_LISTING} element={<SavingSpotlightProducts />} />
            <Route path={ROUTES.BEST_DEAL_PRODUCT_LISTING} element={<BestDealProducts />} />
            <Route path={ROUTES.CART} element={<Cartpage />} />
            <Route path={ROUTES.CHECKOUT} element={<Checkoutpage />} />
            <Route path={`${ROUTES.PRODUCT_DETAIL}/:id`} element={<Singleview />} />
            {/* <Route path="/all-categories" element={<Allcaegoriestheme/>} /> */}
            <Route path={ROUTES.UPLOAD_SLIP} element={<UploadSlip />} />
          </Route>

          <Route path="*" element={<Pagenotfound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
