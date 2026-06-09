import { updateAuthInfo } from "./authHelper";

export const paginationInitialState = {
  isLoading: false,
  items: [],
  total: 0,
  skip: 0,
  limit: 10,
  totalPages: 0,
  message: "",
};

export const paginationInfiniteInitialState = {
  skip: 1,
  isLoading: false,
  items: [],
  hasMore: true,
  others: null,
};

export const paginateFulfilled = (field) => (state, action) => {
  state[field].isLoading = false;
  state[field].items = action.payload.items;
  state[field].total = action.payload.total;
  state[field].skip = action.payload.skip;
  state[field].limit = action.payload.limit;
  state[field].totalPages = action.payload.totalPages;
};

export const paginatePending = (field) => (state, action) => {
  state[field].isLoading = true;
  state[field].message = "";
};

export const paginateRejected = (field) => (state, action) => {
  if (action.payload?.aborted) return;
  state[field].isLoading = false;
  state[field].message =
    typeof action.payload === "string"
      ? action.payload
      : action.payload?.message || "Something went wrong.";
  if (Object.prototype.hasOwnProperty.call(state[field], "hasMore")) {
    state[field].hasMore = false;
  }
};

export const paginateInfiniteFulfilled = (field) => (state, action) => {
  state[field].isLoading = false;
  const { items, skip, limit, others = null, hasMore: payloadHasMore } = action.payload;
  const pageItems = Array.isArray(items) ? items : [];
  state[field].items = skip === 1 ? pageItems : [...state[field].items, ...pageItems];
  const limitNum = Math.max(1, Number(limit) || pageItems.length || 1);
  const inferredHasMore =
    typeof payloadHasMore === "boolean"
      ? payloadHasMore
      : pageItems.length >= limitNum;
  if (skip === 1 && pageItems.length === 0) {
    state[field].hasMore = false;
  } else {
    state[field].hasMore = inferredHasMore;
  }
  state[field].skip = skip;
  state[field].others = others;
};

export const loginSuccess = (state, action) => {
  state.message = "";
  state.isLoading = false;
  state.user = action.payload.user;
  state.authToken = action.payload.token;
  state.isLogin = true;
  updateAuthInfo(state.authToken, state.user);
};

export const pendingState = (state, action) => {
  state.isLoading = true;
  state.message = "";
}

export const failedState = (state, action) => {
  state.isLoading = false;
  state.message = action.payload;
}