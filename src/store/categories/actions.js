import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiGet } from "../../helpers/apiHelper";
import { CATEGORIES } from "../../helpers/urlHelper";
import { SOURCE_APPLICATION, TOP_CATEGORIES } from "../../helpers/storeHelper";

const getCategories = (url, localQuery) => async (query, Thunk) => {
  try {
    // const hasData = getStorageList(localQuery);
    // if (hasData !== false)
    //   return hasData;

    const res = await apiGet(url, query);
    if (res.status === "success") {
      // setStorageList(localQuery, res?.data || []);
      return res.data;
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    return Thunk.rejectWithValue(
      error.message || "Something went wrong, please try again later."
    );
  }
};

export const apiGetCategories = createAsyncThunk(
  "apiGetCategories",
  async ({ level = 1 }, Thunk) => {
    try {
      const res = await apiGet(CATEGORIES.LIST_BY_LEVEL, { level });
      if (res.status === "success") {
        return [level, res.data];
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
export const apiGetTopCategories = createAsyncThunk(
  "apiGetTopCategories",
  getCategories(CATEGORIES.TOP_CATEGORIES, TOP_CATEGORIES)
);
export const apiGetSourceByApplication = createAsyncThunk(
  "apiGetSourceByApplication",
  getCategories(CATEGORIES.SOURCE_APPLICATION, SOURCE_APPLICATION)
);
