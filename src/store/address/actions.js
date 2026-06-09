import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiDelete, apiGet, apiPost, apiPut } from "../../helpers/apiHelper";
import { ADDRESS } from "../../helpers/urlHelper";

export const apiGetAddresses = createAsyncThunk(
  "apiGetAddresses",
  async (query, Thunk) => {
    try {
      const res = await apiGet(`${ADDRESS.LIST}`, query);
      if (res.status === "success") {
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

export const apiGetAddress = createAsyncThunk(
  "apiGetAddress",
  async (id, Thunk) => {
    try {
      const res = await apiGet(`${ADDRESS.VIEW}/${id}`);
      if (res.status === "success") {
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

export const apiAddAddress = createAsyncThunk(
  "apiAddAddress",
  async ({ data, callback }, Thunk) => {
    try {
      const res = await apiPost(`${ADDRESS.ADD}`, data);
      if (res.status === "success") {
        callback(res);
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

export const apiUpdateAddress = createAsyncThunk(
  "apiUpdateAddress",
  async ({ data, id, callback }, Thunk) => {
    try {
      const res = await apiPut(`${ADDRESS.UPDATE}/${id}`, data);
      if (res.status === "success") {
        callback(res);
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

export const apiMakeDefaultAddress = createAsyncThunk(
  "apiMakeDefaultAddress",
  async ({ id }, Thunk) => {
    try {
      const res = await apiPut(`${ADDRESS.MAKE_DEFAULT}/${id}`);
      if (res.status === "success") {
        Thunk.dispatch(apiGetAddresses());
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

export const apiDeleteAddress = createAsyncThunk(
  "apiDeleteAddress",
  async ({ id, callback }, Thunk) => {
    try {
      const res = await apiDelete(`${ADDRESS.DELETE}/${id}`);
      if (res.status === "success") {
        callback(res);
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
