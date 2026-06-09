import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiDelete, apiGet, apiPost, apiPut } from "../../helpers/apiHelper";
import { CART } from "../../helpers/urlHelper";

export const apiAddToCart = createAsyncThunk(
  "apiAddToCart",
  async ({ data, callback }, Thunk) => {
    try {
      const res = await apiPost(CART.ADD, data);
      if (res.status === "success") {
        callback(res);
        Thunk.dispatch(apiGetCartCount());
        return res.data;
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiGetCartCount = createAsyncThunk(
  "apiGetCartCount", async (query = {}, Thunk) => {
    try {
      const res = await apiGet(CART.COUNT, query);
      if (res.status === "success") {
        return res.data?.count || 0;
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiGetCartList = createAsyncThunk(
  "apiGetCartList",
  async ({ callback = () => { } }, Thunk) => {
    try {
      const res = await apiGet(CART.LIST);
      callback(res);
      if (res.status === "success") {
        return res.data || [];
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiUpdateCart = createAsyncThunk(
  "apiUpdateCart",
  async ({ id, data }, Thunk) => {
    try {
      const res = await apiPut(CART.UPDATE + "/" + id, data);
      // Thunk.dispatch(apiGetCartList({}));
      Thunk.dispatch(apiGetCartCount());
      return res;
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiDeleteCart = createAsyncThunk(
  "apiDeleteCart",
  async (id, Thunk) => {
    try {
      const res = await apiDelete(CART.DELETE + "/" + id);
      Thunk.dispatch(apiGetCartList({}));
      Thunk.dispatch(apiGetCartCount());
      return res;
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);
