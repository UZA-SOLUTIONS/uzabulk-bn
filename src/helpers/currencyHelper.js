import { defaultExchangeRate } from "../config/constants";

const CURRENCY_SYMBOL = "uza-currency-symbol-latest";


export const getCurrencySymbol = () => {
    // return localStorage.getItem(CURRENCY_SYMBOL) || defaultExchangeRate.code;
    return defaultExchangeRate.code;
};

export const setCurrencySymbol = (symbol) => {
    localStorage.setItem(CURRENCY_SYMBOL, symbol);
}