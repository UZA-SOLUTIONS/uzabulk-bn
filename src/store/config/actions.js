import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient, { apiGet } from "../../helpers/apiHelper";
import { CONFIGURATIONS } from "../../helpers/urlHelper";

export const apiGetConfigurations = createAsyncThunk(
  "apiGetConfigurations",
  async (data, Thunk) => {
    try {
      const res = await apiGet(CONFIGURATIONS.GET);
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


export const apiGetCurrencies = createAsyncThunk(
  "apiGetCurrencies",
  async (data, Thunk) => {
    try {
      const res = await apiClient.get(CONFIGURATIONS.CURRENCIES);
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