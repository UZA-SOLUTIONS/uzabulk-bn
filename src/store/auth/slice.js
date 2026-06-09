import { createSlice } from "@reduxjs/toolkit";
import {
  apiForgotPassword,
  apiGetProfile,
  apiLogin,
  apiLogout,
  apiRegister,
  apiResetPassword,
  apiUpdateProfile,
} from "./actions";
import {
  getAuthToken,
  getUserData,
  removeAuthInfo,
  saveCredentials,
  updateUserStorage,
} from "../../helpers/authHelper";
import { loginSuccess } from "../../helpers/reduxHelper";
import ROUTES from "../../helpers/routesHelper";

const authToken = getAuthToken();

const forgotPassword = {
  countryCode: "",
  mobileNumber: "",
  otp: "",
  isLoading: false,
  message: "",
};

const initialState = {
  user: getUserData(),
  profile: null,
  isLogin: authToken ? true : false,
  authToken,
  isLoading: false,
  message: "",
  forgotPassword: forgotPassword,
};

export const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setForgotPasswordOtp: (state, action) => {
      state.forgotPassword.otp = action.payload;
    },
    clearForgotPasswordState: (state, action) => {
      state.forgotPassword = forgotPassword;
    },
    clearUserProfile: (state, action) => {
      state.profile = null;
    },
  },
  extraReducers: (builder) => {
    // Create account
    builder
      .addCase(apiRegister.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiRegister.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiRegister.fulfilled, loginSuccess);

    // Login account
    builder
      .addCase(apiLogin.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiLogin.fulfilled, loginSuccess);

    // Logout account
    builder
      .addCase(apiLogout.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiLogout.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiLogout.fulfilled, (state, action) => {
        removeAuthInfo();
        window.location.href = `${ROUTES.HOME}?auth=signin`;
      });

    // Get profile
    builder
      .addCase(apiGetProfile.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiGetProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiGetProfile.fulfilled, (state, action) => {
        state.message = "";
        state.isLoading = false;
        state.profile = action.payload;
        state.user = action.payload;
        updateUserStorage(state.user);
      });

    // Update profile
    builder
      .addCase(apiUpdateProfile.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiUpdateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiUpdateProfile.fulfilled, (state, action) => {
        state.message = "";
        state.isLoading = false;
        state.user = action.payload;
        state.profile = action.payload;
        saveCredentials(
          {
            countryCode: state?.profile?.countryCode || "",
            mobileNumber: state?.profile?.mobileNumber || "",
          },
          true
        );
        updateUserStorage(state.user);
      });

    // Forgot password
    builder
      .addCase(apiForgotPassword.pending, (state, action) => {
        state.forgotPassword.isLoading = true;
      })
      .addCase(apiForgotPassword.rejected, (state, action) => {
        state.forgotPassword.isLoading = false;
        state.forgotPassword.message = action.payload;
      })
      .addCase(apiForgotPassword.fulfilled, (state, action) => {
        state.forgotPassword.message = "";
        state.forgotPassword.isLoading = false;
        state.forgotPassword.countryCode = action.payload.countryCode;
        state.forgotPassword.mobileNumber = action.payload.mobileNumber;
      });

    // Reset password
    builder
      .addCase(apiResetPassword.pending, (state, action) => {
        state.forgotPassword.isLoading = true;
      })
      .addCase(apiResetPassword.rejected, (state, action) => {
        state.forgotPassword.isLoading = false;
        state.forgotPassword.message = action.payload;
      })
      .addCase(apiResetPassword.fulfilled, (state, action) => {
        state.forgotPassword.message = "";
        state.forgotPassword.isLoading = false;
        state.forgotPassword.countryCode = "";
        state.forgotPassword.mobileNumber = "";
        state.forgotPassword.otp = "";
      });
  },
});

export const {
  setForgotPasswordOtp,
  clearForgotPasswordState,
  clearUserProfile,
} = slice.actions;

export default slice.reducer;
