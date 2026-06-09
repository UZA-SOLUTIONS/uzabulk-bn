import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiGet } from "../../helpers/apiHelper";
import { PAGE } from "../../helpers/urlHelper";

const getContent = (url) => async (query, Thunk) => {
  try {
    const res = await apiGet(url);
    if (res.status === "success") {
      return res.data;
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    return Thunk.rejectWithValue(error.message || "Something went wrong, please try again later.");
  }
}

export const apiGetAboutUsPage = createAsyncThunk("apiGetAboutUsPage", getContent(PAGE.ABOUT_US));
export const apiGetContactUsPage = createAsyncThunk("apiGetContactUsPage", getContent(PAGE.CONTACT_US));
export const apiGetPrivacyPolicyPage = createAsyncThunk("apiGetPrivacyPolicyPage", getContent(PAGE.PRIVACY_POLICY));
export const apiGetTermAndConditionsPage = createAsyncThunk("apiGetTermAndConditionsPage", getContent(PAGE.T_AND_C));