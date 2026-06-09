import { updateAuthToken } from "./apiHelper";
import { logger } from "./commonHelper";

const TOKEN_KEY = "uza-retail-auth-token";
const USER_KEY = "uza-retail-user-data";
const USER_CREDENTIALS = "uza-retail-user-credentials";

export const removeAuthInfo = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  updateAuthToken();
};

export const updateAuthInfo = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  updateAuthToken();
};

export const updateUserStorage = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getUserData = () => {
  return JSON.parse(localStorage.getItem(USER_KEY) || null);
};

export const getCredentials = () => {
  return JSON.parse(localStorage.getItem(USER_CREDENTIALS) || null);
};

export const saveCredentials = (data, update = false) => {
  if (update) {
    const credentials = getCredentials();
    if (credentials?.rememberMe) {
      logger({ ...credentials, ...data });
      localStorage.setItem(
        USER_CREDENTIALS,
        JSON.stringify({ ...credentials, ...data })
      );
    }
  } else {
    localStorage.setItem(USER_CREDENTIALS, JSON.stringify(data));
  }
};

export const removeCredentials = () => {
  localStorage.removeItem(USER_CREDENTIALS);
};
