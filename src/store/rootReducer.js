import { combineReducers } from "@reduxjs/toolkit";
import auth from "./auth/slice";
import products from "./products/slice";
import categories from "./categories/slice";
import cart from "./cart/slice";
import order from "./order/slice";
import address from "./address/slice";
import page from "./page/slice";
import config from "./config/slice";

export default combineReducers({
  auth,
  products,
  categories,
  cart,
  order,
  address,
  page,
  config,
});
