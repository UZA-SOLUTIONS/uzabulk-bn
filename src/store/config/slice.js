import { createSlice } from "@reduxjs/toolkit";
import { apiGetConfigurations, apiGetCurrencies } from "./actions";
import { failedState, pendingState } from "../../helpers/reduxHelper";
import { logger } from "../../helpers/commonHelper";
import { getCurrencySymbol, setCurrencySymbol } from "../../helpers/currencyHelper";
import { defaultExchangeRate } from "../../config/constants";

const initialState = {
  data: null,
  currencies: [],
  currentCurrency: defaultExchangeRate,
  isLoading: false,
  message: "",
};


export const slice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCurrency: (state, action) => {
      state.currentCurrency = action.payload;
      logger("CURRENT CURRENCY ::: ", action.payload, state.currentCurrency?.code)
      setCurrencySymbol(state.currentCurrency?.code || defaultExchangeRate.code);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(apiGetConfigurations.pending, pendingState)
      .addCase(apiGetConfigurations.rejected, failedState)
      .addCase(apiGetConfigurations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.message = "";
        state.data = action.payload;
      });

    builder
      .addCase(apiGetCurrencies.pending, pendingState)
      .addCase(apiGetCurrencies.rejected, failedState)
      .addCase(apiGetCurrencies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.message = "";
        state.currencies = action.payload;
        if (action.payload?.length) {
          if (!action.payload.some((currency) => currency?.code === getCurrencySymbol())) {
            state.currentCurrency = action.payload[0];
          }
          else {
            state.currentCurrency = action.payload.find((currency) => currency?.code === getCurrencySymbol());
          }
          setCurrencySymbol(state?.currentCurrency?.code || getCurrencySymbol());
        }
      });
  },
});

export const { setCurrency } = slice.actions;

export default slice.reducer;
