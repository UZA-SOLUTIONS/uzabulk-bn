import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiGet, apiPost, apiPut } from "../../helpers/apiHelper";
import { AUTH, FORGOT_PASSWORD, PROFILE } from "../../helpers/urlHelper";
import { toast } from "react-toastify";
import { updateAuthInfo } from "../../helpers/authHelper";

const normalizeApiErrorMessage = (error) => {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error?.message && typeof error.message === "string") return error.message;
  if (error?.data?.message && typeof error.data.message === "string") return error.data.message;
  return "Something went wrong, please try again later.";
};

/** Normalize login/register success body from apiClient (already unwrapped axios `data`). */
const pickAuthPayload = (res) => {
  if (!res || res.status !== "success") return null;
  const pack = res.data != null && typeof res.data === "object" ? res.data : res;
  if (!pack || typeof pack !== "object") return null;
  const token = pack.token || pack.accessToken || pack.access_token;
  const user = pack.user;
  if (!token || user == null) return null;
  return { token, user };
};

export const apiVerifyEmail = createAsyncThunk(
  "apiVerifyEmail",
  async ({ data, callback }, Thunk) => {
    try {
      const res = await apiPost(AUTH.VERIFY_EMAIL, data);
      callback(res);
      return res.data;
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiVerifyMobile = createAsyncThunk(
  "apiVerifyMobile",
  async ({ data, callback }, Thunk) => {
    try {
      const res = await apiPost(AUTH.VERIFY_MOBILE, data);
      callback(res);
      return res.data;
    } catch (error) {
      return Thunk.rejectWithValue(
        error.message || "Something went wrong, please try again later."
      );
    }
  }
);

export const apiVerifyOtp = createAsyncThunk("apiVerifyOtp", async ({ data, callback }, Thunk) => {
  try {
    const res = await apiPost(AUTH.VERIFY_OTP, data);
    callback(res);
    return res.data;
  } catch (error) {
    return Thunk.rejectWithValue(error.message || "Something went wrong, please try again later.");
  }
});

export const apiRegister = createAsyncThunk("apiRegister", async ({ data, callback }, Thunk) => {
  try {
    const res = await apiPost(AUTH.REGISTER, data);
    const payload = pickAuthPayload(res);
    if (!payload) {
      throw new Error(res?.message || "Registration failed");
    }
    updateAuthInfo(payload.token, payload.user);
    if (typeof callback === "function") {
      callback(res);
    }
    return payload;
  } catch (error) {
    return Thunk.rejectWithValue(normalizeApiErrorMessage(error));
  }
});

export const apiLogin = createAsyncThunk("apiLogin", async ({ data, callback }, Thunk) => {
  try {
    const res = await apiPost(AUTH.LOGIN, data);
    const payload = pickAuthPayload(res);
    if (!payload) {
      throw new Error(res?.message || "Login failed");
    }
    updateAuthInfo(payload.token, payload.user);
    if (typeof callback === "function") {
      callback(res);
    }
    return payload;
  } catch (error) {
    return Thunk.rejectWithValue(normalizeApiErrorMessage(error));
  }
});

export const apiLogout = createAsyncThunk("apiLogout", async (body, Thunk) => {
  try {
    const res = await apiPost(AUTH.LOGOUT, body);
    if (res.status === "success") {
      return res.data;
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    return Thunk.rejectWithValue(error.message || "Something went wrong, please try again later.");
  }
});

export const apiGetProfile = createAsyncThunk("apiGetProfile", async (body, Thunk) => {
  try {
    const res = await apiGet(PROFILE.GET);
    if (res.status === "success") {
      return res.data;
    } else {
      throw new Error(res.message);
    }
  } catch (error) {
    return Thunk.rejectWithValue(error.message || "Something went wrong, please try again later.");
  }
});

export const apiUpdateProfile = createAsyncThunk(
  "apiUpdateProfile",
  async ({ data, callback = () => {} }, Thunk) => {
    try {
      const res = await apiPut(PROFILE.UPDATE, data);
      if (res.status === "success") {
        toast.success(res.message);
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

export const apiChangePassword = createAsyncThunk(
  "apiChangePassword",
  async ({ callback, body }, Thunk) => {
    try {
      const res = await apiPut(PROFILE.CHANGE_PASSWORD, body);
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

// Forgot password
export const apiForgotPassword = createAsyncThunk(
  "apiForgotPassword",
  async ({ callback, data }, Thunk) => {
    try {
      const res = await apiPost(FORGOT_PASSWORD.SEND_OTP, data);
      if (res.status === "success") {
        callback(res);
        return data;
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

// Forgot password
export const apiResetPassword = createAsyncThunk(
  "apiResetPassword",
  async ({ callback, data }, Thunk) => {
    try {
      const res = await apiPost(FORGOT_PASSWORD.RESET, data);
      if (res.status === "success") {
        callback(res);
        return res;
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
