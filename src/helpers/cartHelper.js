import { toast } from "react-toastify";
import { manageProductForCart, setAddedInCart } from "../store/products/slice";
import { isEqualArray, scrollToId, logger, formatNumber } from "./commonHelper";
import { apiAddToCart, apiUpdateCart } from "../store/cart/actions";
// import { apiDeleteCart } from "../store/cart/actions";
import { updateCartList } from "../store/cart/slice";
import { store } from "../store/store";
import { CURRENCY_SYMBOL } from "../config/constants";

const dispatch = store.dispatch;

export const onChangeVariation = ({
  detail,
  attributeIndex,
  termIndex,
}) => {
  let newAttributes = detail.attributes.map((attr, attrIndex) => {
    if (attrIndex === attributeIndex) {
      // Create a new array of terms
      let newTerms = attr.terms.map((trm, id) => {
        if (id === termIndex) {
          return { ...trm, active: true };
        }
        return { ...trm, active: false };
      });
      return { ...attr, terms: newTerms }; // Return new attribute object with updated terms
    }
    return attr; // Return unchanged attribute
  });

  // Create a new product object with updated attributes
  const updatedProduct = { ...detail, attributes: newAttributes };
  dispatch(manageProductForCart(updatedProduct));
};

const getAttributeId = (attributes, id) => {
  for (const attr of attributes) {
    for (const term of attr.terms) {
      if (term._id === id) {
        return attr._id;
      }
    }
  }

  return null;
};

export const addToCart = ({ cartData, isLogin }) => {
  if (cartData?.items?.length) {
    dispatch(
      apiAddToCart({
        data: cartData,
        callback: () => {
          toast.success("Cart updated successfully!");
          dispatch(setAddedInCart({ variation_id: cartData.items[0].variation_id }));
        },
      })
    );
  } else {
    toast.warn("Please add items to add cart!");
  }
};

// Cart listing page
export const manageCartQuantity = ({
  cartList,
  cartListIndex,
  cart,
  cartIndex,
  increase = true,
  setValue = null,
}) => {
  const items = cart.items.map((xItem, i) => {
    const item = { ...xItem };
    if (i === cartIndex) {
      const quantity = Math.max(
        setValue !== null
          ? setValue
          : increase
            ? item.quantity + 1
            : item.quantity - 1,
        0
      );
      return {
        ...item,
        message: "",
        quantity: isNaN(quantity) ? 0 : quantity,
      };
    } else {
      item.message = "";
      return item;
    }
  });

  const newCart = [...cartList];
  newCart[cartListIndex] = { ...newCart[cartListIndex], items, isLoading: true };

  dispatch(updateCartList(newCart));

  if (items[cartIndex].quantity === 0) {
    dispatch(
      apiUpdateCart({
        id: cart._id,
        data: {
          operateType: "MANUAL_DELETED",
          items: [
            {
              _id: items[cartIndex]._id,
            },
          ],
        },
      })
    );
  } else {
    // Update cart quantity
    dispatch(
      apiUpdateCart({
        id: cart._id,
        data: {
          operateType: "UPDATE",
          items: items.map((item) => ({
            _id: item._id,
            quantity: item.quantity,
            variation_id: item.variation_id,
            attributes: item.attributes?.map((attr) => ({
              attrId: attr.attrId,
              attrTermId: attr.attrTermId,
            })),
          })),
        },
      })
    );
  }
};

export const getCouponDiscount = ({ orderDetails, cart, cartItem }) => {
  let discountText = "";
  if (orderDetails?.line_items?.length) {
    orderDetails?.line_items.forEach((item) => {
      item.items.forEach((value) => {
        if (value._id === cartItem._id && value.discountTotal) {
          discountText = "Coupon discount " + CURRENCY_SYMBOL + formatNumber(value.discountTotal);
        }
      });
    });
  }
  return discountText;
};

export const isReadyToPlaceOrder = (orderDetails) => {
  logger("orderDetails", orderDetails);
  if (orderDetails) {
    for (const item of orderDetails?.line_items || []) {
      let quantity = 0;
      for (const itm of item.items) {
        if (!itm?.stock?.instock) {
          return false;
        }
        else if (itm?.stock?.instock && itm?.stock?.quantity && itm?.stock?.quantity < itm.quantity) {
          return false;
        }
        quantity += itm.quantity;
      }

      if (quantity < item.items[0].minQuantity) {
        return false;
      }
    }

    return true;
  }
  else {
    return false;
  }
};

let isScrolledToError = false;
export const getCheckoutErrorMessage = ({ orderDetails, cart, index }) => {
  if (index === 0) isScrolledToError = false;

  if (orderDetails) {
    for (const item of orderDetails?.line_items || []) {
      if (item.cart_id === cart._id) {
        let quantity = 0;
        for (const itm of item.items) {
          if (!itm?.stock?.instock || (itm?.stock?.instock && itm?.stock?.quantity && itm?.stock?.quantity === 0)) {
            return "The product " + (itm?.attributes?.length ? "\"" + (itm.attributes.map((a) => a.attrValue)).join(" / ") + "\" " : "") + "is out of stock.";
          }
          else if (itm?.stock?.instock && itm?.stock?.quantity && itm?.stock?.quantity < itm.quantity) {
            logger("ITEM", itm);
            return "The product " + (itm?.attributes?.length ? "\"" + (itm.attributes.map((a) => a.attrValue)).join(" / ") + "\" " : "") + "has only " + itm?.stock?.quantity + " items(s) left.";
          }
          quantity += itm.quantity;
        }

        if (quantity < item.items[0].minQuantity) {
          if (!isScrolledToError) {
            scrollToId(cart._id);
            isScrolledToError = true;
          }
          return "The total quantity of this product must be greater than the " + item.items[0].minQuantity;
        }
      }
    }
  }

  return "";
};

const updateStock = (data, stock = { instock: true, quantity: Infinity }) => {
  if (!data.manage_stock && data.stock_status === "outofstock") {
    stock.instock = false;
    stock.quantity = 0;
  }
  else if (data.manage_stock) {
    stock.instock = data.stock_quantity > 0;
    stock.quantity = data.stock_quantity;
  }

  return stock;
}


// Retailer functions
export const getProductInfo = (detail) => {
  let price = detail?.price || 0;
  let stock = { instock: true, quantity: Infinity };
  let addedInCart = false;
  let productId = detail?._id || null;
  let variationId = null;

  let cartData = {
    product: productId,
    items: [],
  };

  if (detail) {
    if (detail?.variations?.length) {
      const activeAttributes = [];

      for (const attributes of detail.attributes) {
        for (const term of attributes.terms) {
          if (term.active) {
            activeAttributes.push(term._id);
            break;
          }
        }
      }

      for (const variation of detail.variations) {
        const attributes = variation?.attributes?.map((attr) => attr._id);
        if (isEqualArray(attributes, activeAttributes)) {

          logger("Selected variation", variation);

          variationId = variation._id;
          price = variation.price;
          addedInCart = !!variation?.addedInCart;

          cartData.items = [{
            product: productId,
            quantity: 1,
            variation_id: variationId,
            attributes: variation.attributes.map((attribute) => ({
              attrId: getAttributeId(detail?.attributes, attribute._id),
              attrTermId: attribute._id,
            })),
          }];

          updateStock(variation, stock);
          break;
        }
      }
    }
    else {

      addedInCart = !!detail?.addedInCart;

      cartData.items = [{
        product: productId,
        quantity: 1,
        variation_id: variationId,
        attributes: [],
      }];

      updateStock(detail, stock);
    }
  }
  logger({ price, stock, addedInCart, cartData });
  return { price, stock, addedInCart, cartData };
}


export const getPendingQuantity = (product) => {
  let pendingQty = 0;
  if (product?.variations?.length) {
    product.variations.forEach((variation) => {
      const { quantity } = updateStock(variation);
      pendingQty += quantity;
    });
  }
  else {
    const { quantity } = updateStock(product);
    pendingQty += quantity;
  }
  return pendingQty;
}