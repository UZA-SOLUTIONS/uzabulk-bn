import { createSlice } from "@reduxjs/toolkit";
import { apiCheckout, apiGetOrderDetail, apiGetOrders, apiPlaceOrder } from "./actions";
import { paginateFulfilled, paginatePending, paginateRejected, paginationInitialState } from "../../helpers/reduxHelper";
const initialState = {
  orders: paginationInitialState,
  orderDetails: null,
  placedOrderDetails: null,
  detail: null,
  isLoading: false,
  message: "",
};

export const slice = createSlice({
  name: "order",
  initialState,
  reducers: {
    removeOrderDetails: (state, action) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Checkout
    builder
      .addCase(apiCheckout.pending, (state, action) => {
        state.message = "";
        state.isLoading = true;
      })
      .addCase(apiCheckout.rejected, (state, action) => {
        state.message = action.payload;
        state.isLoading = false;
      })
      .addCase(apiCheckout.fulfilled, (state, action) => {
        state.message = "";
        state.isLoading = false;
        state.orderDetails = action.payload.data;
      });

    // Place Odrder
    builder
      .addCase(apiPlaceOrder.pending, (state, action) => {
        state.message = "";
        state.isLoading = true;
      })
      .addCase(apiPlaceOrder.rejected, (state, action) => {
        state.message = action.payload;
        state.isLoading = false;
      })
      .addCase(apiPlaceOrder.fulfilled, (state, action) => {
        state.message = "";
        state.isLoading = false;
        state.placedOrderDetails = action.payload.data;
      });

    // Order detail
    builder
      .addCase(apiGetOrderDetail.pending, (state, action) => {
        state.message = "";
        state.isLoading = true;
      })
      .addCase(apiGetOrderDetail.rejected, (state, action) => {
        state.message = action.payload;
        state.isLoading = false;
      })
      .addCase(apiGetOrderDetail.fulfilled, (state, action) => {
        state.message = "";
        state.isLoading = false;
        state.detail = action.payload;
      });

    // Get orders
    builder
      .addCase(apiGetOrders.fulfilled, paginateFulfilled("orders"))
      .addCase(apiGetOrders.pending, paginatePending("orders"))
      .addCase(apiGetOrders.rejected, paginateRejected("orders"));
  },
});

export const { removeOrderDetails } = slice.actions;

export default slice.reducer;
