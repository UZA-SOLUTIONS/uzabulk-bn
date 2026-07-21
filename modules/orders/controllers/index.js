const Cart = require('../services/cart');
const Order = require('../services/order');
const validation = require("../input-validation");
const Pricing = require("../helper/pricing");
const Coupon = require('../../../models/couponTable');
const helper = require("../helper");
const { getDate, paymentSlipUploadLink, verifyToken } = require('../../../utils');
const { v4: uuidv4 } = require('uuid');
const { trackProductBehavior } = require('../../products/services/recommendationService');
const { getPersonalizedSurface } = require('../../recommendations/services/recommendationEngineService');
const {
    relayOrderTo1688,
    sync1688OrderState,
    confirm1688Payment,
} = require('../services/alibabaOrderRelay');
const OrderModel = require('../../../models/ordersTable');

const trackCheckoutLineItems = (req, lineItems = [], eventType = "checkout") => {
    lineItems.forEach((lineItem) => {
        (lineItem.items || []).forEach((item) => {
            trackProductBehavior(req, {
                productId: item.product,
                eventType,
                score: eventType === "order" ? 10 : 7,
                metadata: {
                    quantity: item.quantity,
                    cartId: lineItem.cart_id,
                    orderGroupId: lineItem.orderGroupId,
                },
            });
        });
    });
};

module.exports = {

    checkoutCalculationMiddleware: async (req, isOrder = false) => {
        let user = req.user;
        const { exchangeRate, symbol, code } = req.exchangeRate;

        let data = req.body;
        data.user = user?._id;
        let query = { _id: data.cart_ids, deviceId: req.deviceId, cartType: "temp" };
        if (user?._id) {
            query = { _id: data.cart_ids, user: user._id, cartType: "default" };
        }

        let cartList = await Cart.cartList(query);

        if (!cartList?.length) {
            throw "CART_IDS_INVALID";
        }

        // Address
        const deliveryFeeCalculation = await Pricing.deliveryFeeCalculation(data);
        if (deliveryFeeCalculation.error && isOrder) {
            throw deliveryFeeCalculation.message;
        };

        data.deliveryFee = Number(deliveryFeeCalculation?.deliveryFee) || 0;
        data.shippingDetails = deliveryFeeCalculation?.shippingDetails;
        data.billingDetails = deliveryFeeCalculation?.billingDetails;

        await Cart.updateLatestPricing(cartList);
        // Skip Alibaba freight while storefront delivery fees stay at 0.
        data.skipFreightEstimate = true;
        let line_items = await validation.generateLineItemsForCheckOut(req.exchangeRate, data, cartList, deliveryFeeCalculation, isOrder);
        data.totalItems = line_items.totalItems;
        data.subTotal = Number(line_items.subTotal) || 0;
        data.line_items = (line_items.line_items || []).map((line) => {
            const discountTotal = Number(line.discountTotal) || 0;
            const tax = Number(line.tax) || 0;
            const subTotal = Number(line.subTotal) || 0;
            return {
                ...line,
                deliveryFee: 0,
                finalAmount: helper.toFixedNumber((subTotal + tax) - discountTotal),
            };
        });
        // Delivery fees disabled for storefront checkout/orders.
        data.deliveryFee = 0;
        data.orderTotal = data.subTotal;
        data.discountTotal = 0;


        // Apply coupon discount if available
        if (data.coupon) {
            const getCoupon = await Coupon.getCoupon(data.coupon);
            if (!getCoupon) {
                if (isOrder) {
                    throw "INVALID_PROMO_CODE";
                }

                data.couponError = "Promo code is not valid.";
                data.coupon = "";
            } else {
                const { exchangeRate, symbol, code } = req.exchangeRate;
                if (getCoupon.discount_type == "flat") getCoupon.amount = getCoupon.amount * exchangeRate;
                if (getCoupon.discount_type == "flat" && data.subTotal < getCoupon.amount) {
                    data.couponError = "This coupon can be applied on a minimum purchase of " + symbol + " " + getCoupon.amount + ".";
                    data.coupon = "";
                    if (isOrder) {
                        throw data.couponError;
                    }
                }
                else {
                    let couponCost = await validation.applyPromoOnLineItems(data.line_items, getCoupon, data.subTotal, isOrder);
                    if (couponCost?.error) {
                        data.couponError = couponCost.error;
                        data.coupon = "";
                    }
                    else {
                        if (!isOrder) {
                            await _model.User.setCoupon(user._id, getCoupon._id);
                        }
                        data.couponType = getCoupon.type;
                        data.couponBy = getCoupon.discount_type;
                        data.couponAmount = getCoupon.amount;
                        data.couponError = couponCost.error;
                        data.discountTotal = couponCost.discountTotal;
                        // data.subTotal = couponCost.subTotal;
                        data.line_items = couponCost.line_items;
                    }

                }
            }
        };

        //calculate tax
        const getTax = Pricing.taxCalculation(env.taxSettings, 0, data.subTotal);
        data.tax = Number(getTax.tax) || 0;
        data.taxAmount = getTax.taxAmount;
        data.discountTotal = Number(data.discountTotal) || 0;
        data.orderTotal = helper.toFixedNumber(
            (data.subTotal + data.tax) - data.discountTotal
        );
        if (!Number.isFinite(Number(data.orderTotal))) {
            data.orderTotal = data.subTotal;
        }

        return data;
    },

    list: async (req, res) => {
        try {
            const user = req.user;

            const query = { orderStatus: { $ne: 'archived' }, user: user._id };

            const orders = await Order.list(query, req.paginationOptions);
            let total = await Order.countData(query);

            return res.success(req.nextPageOptions(orders, total));

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },

    view: async (req, res) => {
        try {
            const user = req.user;
            const { _id } = req.params;

            const order = await Order.orderById(_id);
            if (!order) {
                return res.error("INVALID_ORDER_ID");
            }

            return res.success("RECORD_FOUND", order);

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },

    track: async (req, res) => {
        try {
            const q = String(req.query.q || req.query.orderId || "").trim();
            if (!q) {
                return res.error("ORDER_ID_REQUIRED");
            }

            // Public track-by-number: no sign-in required when the order number exists.
            let order = await Order.findForTrack(q, req.user?._id || null);

            // If logged-in scoped lookup missed, fall back to global order-number match.
            if (!order && req.user?._id) {
                order = await Order.findForTrack(q, null);
            }

            if (!order) {
                return res.error("ORDER_NOT_FOUND");
            }

            return res.success("RECORD_FOUND", order);
        } catch (error) {
            console.error(error);
            res.error(error);
        }
    },

    checkout: async (req, res) => {
        try {
            const checkout = await module.exports.checkoutCalculationMiddleware(req);
            trackCheckoutLineItems(req, checkout.line_items, "checkout");

            checkout.alibaba1688 = {
                trade_enabled: String(process.env.ALIBABA_TRADE_ENABLED || "true").toLowerCase() !== "false",
                line_items: (checkout.line_items || []).map((line) => ({
                    offerId: line.offerId || null,
                    relay_eligible: Boolean(line.offerId && (line.items || []).every((i) => i.spec_id || i.sku_id || i.variation_id)),
                })),
            };

            if (String(process.env.RECOMMENDATION_ENGINE_ENABLED ?? "true").toLowerCase() !== "false") {
                try {
                    const cartProductIds = [];
                    (checkout.line_items || []).forEach((line) => {
                        (line.items || []).forEach((item) => {
                            if (item?.product) cartProductIds.push(String(item.product));
                        });
                    });
                    // Cap wait so cart/checkout totals are not blocked by recs.
                    const crossSellBudgetMs = Math.max(
                        200,
                        Number(process.env.CHECKOUT_CROSS_SELL_TIMEOUT_MS || 800) || 800
                    );
                    const crossSell = await Promise.race([
                        getPersonalizedSurface("cross_sell", req, {
                            cartProductIds,
                            contextKey: cartProductIds.slice(0, 5).join(":") || "empty",
                            limit: 4,
                        }),
                        new Promise((resolve) => setTimeout(() => resolve(null), crossSellBudgetMs)),
                    ]);
                    if (crossSell?.items?.length) {
                        checkout.cross_sell = crossSell.items;
                    }
                } catch (crossSellError) {
                    console.warn("Checkout cross-sell failed:", crossSellError.message);
                }
            }

            return res.success(checkout);

        } catch (error) {
            console.error(error)
            res.error(error)
        }
    },

    createOrder: async (req, res) => {
        try {
            const user = req.user;
            const { paymentMethod = "cod", cart_ids, slipLink = "" } = req.body;
            const receiptLink = String(slipLink || "").trim();

            const checkout = await module.exports.checkoutCalculationMiddleware(req, true);
            const orderGroupId = uuidv4();

            let orders = [];
            const { date, utcDate } = getDate();
            for (const cartItem of checkout.line_items) {
                orders.push({
                    user: user._id,
                    store: env.storeId,
                    storeType: env.storeTypeId,
                    vendor: cartItem.vendor?._id,
                    line_items: cartItem.items,
                    offerId: cartItem.offerId ? String(cartItem.offerId) : "",
                    subTotal: cartItem.subTotal,
                    orderTotal: helper.toFixedNumber((cartItem.subTotal + cartItem.tax) - cartItem.discountTotal),
                    discountTotal: cartItem.discountTotal,
                    deliveryFee: 0,
                    shippingDetails: checkout.shippingDetails,
                    billingDetails: checkout.billingDetails,
                    tax: cartItem.tax,
                    taxAmount: cartItem.taxAmount,
                    paymentMethod: paymentMethod,
                    orderStatus: "pending",
                    customOrderId: helper.generateOrderID(),
                    coupon: checkout.coupon,
                    couponType: checkout.couponType,
                    couponBy: checkout.couponBy,
                    couponAmount: checkout.couponAmount,
                    currency: req.exchangeRate,
                    orderGroupId: orderGroupId,
                    ...(receiptLink
                        ? {
                            slipLink: receiptLink,
                            slipUploadStatus: "uploaded",
                        }
                        : {}),

                    date_created: date,
                    date_created_utc: utcDate,
                    date_customer_confirmed_utc: utcDate,
                    date_modified: date,
                    date_modified_utc: utcDate,
                });
            }

            if (orders.length) {
                const insertedOrders = await Order.createMany(orders);

                for (let i = 0; i < insertedOrders.length; i += 1) {
                    const inserted = insertedOrders[i];
                    const cartLine = checkout.line_items[i];
                    if (!cartLine?.offerId) continue;

                    try {
                        const relay = await relayOrderTo1688({
                            order: inserted,
                            offerId: cartLine.offerId,
                            lineItems: inserted.line_items,
                        });

                        if (relay.ok && relay.alibaba1688) {
                            await OrderModel.updateOne(
                                { _id: inserted._id },
                                { $set: { alibaba1688: relay.alibaba1688 } }
                            );
                            inserted.alibaba1688 = relay.alibaba1688;
                        } else if (!relay.skipped && relay.error) {
                            await OrderModel.updateOne(
                                { _id: inserted._id },
                                { $set: { "alibaba1688.relay_error": String(relay.error) } }
                            );
                            console.warn(`[1688-relay] Order ${inserted._id}: ${relay.error}`);
                        }
                    } catch (relayErr) {
                        console.error(`[1688-relay] Order ${inserted._id}:`, relayErr.message);
                    }
                }

                trackCheckoutLineItems(req, checkout.line_items, "order");
                // Clear the cart for the processed order
                await Cart.clearCartByIds(cart_ids);

                try {
                    Order.sendOrderEmails({ user, orders: insertedOrders });
                    Order.updateProductStocks(insertedOrders);
                }
                catch (err) { console.log(err); }

                return res.success("ORDER_SUCCESS", insertedOrders);
            }

            return res.error("SOMETHING_WENT_WRONG");

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },

    sync1688: async (req, res) => {
        try {
            const _id = req.params.id || req.params._id;
            const order = await Order.orderById(_id);
            if (!order) {
                return res.error("INVALID_ORDER_ID");
            }

            const result = await sync1688OrderState(order);
            if (!result.ok) {
                return res.error(result.error || "SYNC_FAILED");
            }

            await OrderModel.updateOne({ _id }, { $set: result.updates });
            const updated = await Order.orderById(_id);
            return res.success("RECORD_FOUND", updated);
        } catch (error) {
            console.error(error);
            return res.error(error);
        }
    },

    logistics1688: async (req, res) => {
        try {
            const _id = req.params.id || req.params._id;
            const order = await Order.orderById(_id);
            if (!order) {
                return res.error("INVALID_ORDER_ID");
            }

            const result = await sync1688OrderState(order);
            if (result.ok && result.updates) {
                await OrderModel.updateOne({ _id }, { $set: result.updates });
            }

            const updated = await Order.orderById(_id);
            return res.success("RECORD_FOUND", {
                order_id: _id,
                alibaba1688: updated.alibaba1688,
                logistics: updated.alibaba1688?.logistics || [],
            });
        } catch (error) {
            console.error(error);
            return res.error(error);
        }
    },

    createSlipUploadLink: async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.orderById(orderId);
            if (!order) {
                return res.error("INVALID_ORDER_ID");
            }

            if (order?.slipUploadStatus === "uploaded") {
                return res.error("PAYMENT_SLIP_ALREADY_UPLOADED");
            }

            let orders = [];
            if (order?.orderGroupId) {
                orders = await _model.Order.find({ orderGroupId: order.orderGroupId }).lean().exec();
            }

            let link;
            if (orders?.length) {
                link = paymentSlipUploadLink(req.user._id, orders);
            }
            else {
                link = paymentSlipUploadLink(req.user._id, [order]);
            }

            return res.success("LINK_CREATED", { link });

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },

    viewOrderDetail: async (req, res) => {
        try {
            const { data } = req.query;

            const tokenData = verifyToken(data);
            if (!tokenData) {
                return res.error("INVALID_LINK");
            }

            const orders = await _model.Order
                .find({ _id: { $in: tokenData.orderIds } })
                .lean()
                .exec();

            return res.success("RECORD_FOUND", orders);

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },

    uploadSlip: async (req, res) => {
        try {
            const { data, slipLink } = req.body;

            const tokenData = verifyToken(data);
            if (!tokenData) {
                return res.error("INVALID_LINK");
            }

            const orderDocs = await _model.Order
                .find({ _id: { $in: tokenData.orderIds } })
                .lean();

            await _model.Order.updateMany(
                { _id: { $in: tokenData.orderIds } },
                {
                    $set: {
                        slipUploadStatus: "uploaded",
                        slipLink,
                    },
                }
            );

            for (const order of orderDocs) {
                if (order?.alibaba1688?.primary_order_id || order?.alibaba1688?.trade_id) {
                    try {
                        const payResult = await confirm1688Payment(order);
                        if (payResult.ok && payResult.updates) {
                            await OrderModel.updateOne({ _id: order._id }, { $set: payResult.updates });
                        }
                    } catch (payErr) {
                        console.warn(`[1688-pay] Order ${order._id}: ${payErr.message}`);
                    }
                }
            }

            return res.success("SLIP_UPLOADED", orderDocs.length);

        } catch (error) {
            console.error(error)
            res.error(error);
        }
    },
};
