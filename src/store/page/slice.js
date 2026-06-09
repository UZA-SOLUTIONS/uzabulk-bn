import { createSlice } from "@reduxjs/toolkit";
import { apiGetAboutUsPage, apiGetContactUsPage, apiGetPrivacyPolicyPage, apiGetTermAndConditionsPage } from "./actions";
import { failedState, pendingState } from "../../helpers/reduxHelper";

const initialState = {
  isLoading: false,
  message: "",
  aboutUs: null,
  contactUs: null,
  privacyPolicy: null,
  termAndConditions: null,
};

const pageSuccess = (key) => (state, action) => {
  state.isLoading = false;
  state.message = "";
  state[key] = action.payload;
}


export const slice = createSlice({
  name: "page",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(apiGetAboutUsPage.pending, pendingState)
      .addCase(apiGetAboutUsPage.rejected, failedState)
      .addCase(apiGetAboutUsPage.fulfilled, pageSuccess("aboutUs"));

    builder
      .addCase(apiGetContactUsPage.pending, pendingState)
      .addCase(apiGetContactUsPage.rejected, failedState)
      .addCase(apiGetContactUsPage.fulfilled, pageSuccess("contactUs"));

    builder
      .addCase(apiGetPrivacyPolicyPage.pending, pendingState)
      .addCase(apiGetPrivacyPolicyPage.rejected, failedState)
      .addCase(apiGetPrivacyPolicyPage.fulfilled, pageSuccess("privacyPolicy"));

    builder
      .addCase(apiGetTermAndConditionsPage.pending, pendingState)
      .addCase(apiGetTermAndConditionsPage.rejected, failedState)
      .addCase(apiGetTermAndConditionsPage.fulfilled, pageSuccess("termAndConditions"));

  },
});

export default slice.reducer;
