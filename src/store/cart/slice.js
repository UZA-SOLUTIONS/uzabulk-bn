import { createSlice } from "@reduxjs/toolkit";
import { apiAddToCart, apiGetCartCount, apiGetCartList, apiUpdateCart } from "./actions";
import { getCoupon, setCoupon } from "../../helpers/commonHelper";

const initialState = {
  selectedCartList: [],
  cartList: [],
  cartCoupon: getCoupon(),
  isLoading: false,
  message: "",
  count: 0,
};

const updateSelectedCartList = (state) => {
  let oldList = [...state.selectedCartList];
  let newArr = [];
  state.cartList?.forEach((cart) => {
    if (oldList.includes(cart._id)) newArr.push(cart._id);
  });

  state.selectedCartList = newArr;
}

export const slice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    updateCartList: (state, action) => {
      state.isLoading = true;
      state.cartList = action.payload;
    },
    cartListUpdated: (state, action) => {
      state.isLoading = false;
    },
    setSelectedCartList: (state, action) => {
      state.selectedCartList = action.payload;
    },
    clearSelectedCart: (state, action) => {
      state.selectedCartList = [];
    },
    setCouponCode: (state, action) => {
      state.cartCoupon = action.payload || "";
      setCoupon(state.cartCoupon);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(apiGetCartList.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiGetCartList.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
        updateSelectedCartList(state);
      })
      .addCase(apiGetCartList.fulfilled, (state, action) => {
        state.isLoading = false;
        state.message = "";
        state.cartList = action.payload;
        if (!state.cartList?.length) {
          state.cartCoupon = "";
          setCoupon(state.cartCoupon);
        }
      });

    // Add to cart
    builder
      .addCase(apiAddToCart.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiAddToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.message = action.payload;
      })
      .addCase(apiAddToCart.fulfilled, (state, action) => {
        state.isLoading = false;
      });

    // Update Cart
    builder
      .addCase(apiUpdateCart.rejected, (state, action) => {
        state.isLoading = false;
        state.cartList = state.cartList?.map((cart) => {
          return {
            ...cart,
            isLoading: false,
            items: cart.items?.map(item => ({ ...item, isLoading: false }))
          }
        });
      }).addCase(apiUpdateCart.pending, (state, action) => {
        state.isLoading = true;
      })
      .addCase(apiUpdateCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cartList = action.payload.data || [];
        if (!state.cartList?.length) {
          state.cartCoupon = "";
          setCoupon(state.cartCoupon);
        }
        updateSelectedCartList(state);
      });


    // Update Cart count
    builder
      .addCase(apiGetCartCount.fulfilled, (state, action) => {
        state.count = action.payload;
      });

  },
});

export const { updateCartList, cartListUpdated, setSelectedCartList, clearSelectedCart, setCouponCode } = slice.actions;

export default slice.reducer;
