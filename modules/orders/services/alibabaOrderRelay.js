/**
 * Relay UZA checkout orders to 1688 trade API.
 */
const productVariation = require("../../../models/productVariationTable");
const Product = require("../../../models/productsTable");
const {
    createCrossOrder,
    extractTradeIds,
    getBuyerOrderView,
    getPaymentUrl,
    confirmPayment,
    map1688StatusToOrderStatus,
    TRADE_ENABLED,
} = require("./alibabaTrade");
const {
    getLogisticsTrace,
    getLogisticsInfos,
    normalizeLogisticsTrace,
} = require("./alibabaLogistics");

const resolveSpecId = async (item) => {
    if (item.spec_id) return String(item.spec_id);
    if (item.specId) return String(item.specId);

    if (item.variation_id) {
        const variation = await productVariation.findById(item.variation_id).lean();
        if (variation?.specId) return String(variation.specId);
        if (variation?.skuId) return String(variation.skuId);
    }

    if (item.sku_id) return String(item.sku_id);
    return null;
};

const buildCargoParamList = async (lineItems, offerId) => {
    const cargo = [];

    for (const item of lineItems || []) {
        const specId = await resolveSpecId(item);
        if (!specId) {
            throw new Error(`Missing 1688 specId for product line item ${item.product}`);
        }

        cargo.push({
            offerId: Number(offerId),
            specId,
            quantity: Number(item.quantity) || 1,
        });
    }

    return cargo;
};

/**
 * Create 1688 cross-border order for a UZA order document.
 * @param {{ order: object, offerId?: string|number, lineItems: Array }} params
 */
const relayOrderTo1688 = async ({ order, offerId, lineItems }) => {
    if (!TRADE_ENABLED()) {
        return { ok: false, skipped: true, reason: "ALIBABA_TRADE_DISABLED" };
    }

    if (!clientConfigured()) {
        return { ok: false, skipped: true, reason: "ALIBABA_NOT_CONFIGURED" };
    }

    const resolvedOfferId = offerId || await resolveOfferIdFromLineItems(lineItems);
    if (!resolvedOfferId) {
        return { ok: false, skipped: true, reason: "NO_OFFER_ID" };
    }

    const thirdOrderId = order.customOrderId || String(order._id);
    const cargoParamList = await buildCargoParamList(lineItems, resolvedOfferId);

    const createResult = await createCrossOrder({
        thirdOrderId,
        cargoParamList,
        message: order.orderInstructions || `UZA order ${thirdOrderId}`,
    });

    if (!createResult.ok) {
        return {
            ok: false,
            error: createResult.error,
            data: createResult.data,
        };
    }

    const { tradeId, orderIds } = extractTradeIds(createResult);

    let paymentUrl = null;
    const primaryOrderId = orderIds[0] || tradeId;
    if (primaryOrderId) {
        const payResult = await getPaymentUrl(primaryOrderId);
        if (payResult.ok) {
            paymentUrl = payResult.data?.payUrl
                || payResult.data?.url
                || payResult.data?.paymentUrl
                || null;
        }
    }

    return {
        ok: true,
        alibaba1688: {
            trade_id: tradeId,
            order_ids: orderIds,
            primary_order_id: primaryOrderId,
            status: "WAIT_PAY",
            third_order_id: thirdOrderId,
            payment_url: paymentUrl,
            raw_create_response: createResult.data,
            relayed_at: new Date(),
        },
    };
};

const resolveOfferIdFromLineItems = async (lineItems) => {
    const firstProductId = lineItems?.[0]?.product;
    if (!firstProductId) return null;

    const product = await Product.findById(firstProductId).select("offerId").lean();
    return product?.offerId || null;
};

const clientConfigured = () => {
    const client = require("../../../lib/alibaba1688Client");
    return client.isConfigured();
};

/**
 * Sync 1688 order status + logistics onto UZA order document fields.
 */
const sync1688OrderState = async (order) => {
    const alibaba = order.alibaba1688 || {};
    const orderId = alibaba.primary_order_id || alibaba.trade_id;
    if (!orderId) {
        return { ok: false, error: "NO_1688_ORDER_ID" };
    }

    const [buyerView, logisticsInfos, logisticsTrace] = await Promise.all([
        getBuyerOrderView(orderId),
        getLogisticsInfos(orderId),
        getLogisticsTrace(orderId),
    ]);

    const buyerData = buyerView.ok ? buyerView.data : null;
    const status = buyerData?.baseInfo?.status
        || buyerData?.status
        || alibaba.status;

    const logistics = [];
    if (logisticsTrace.ok) {
        logistics.push(...normalizeLogisticsTrace(logisticsTrace));
    } else if (logisticsInfos.ok) {
        logistics.push(...normalizeLogisticsTrace(logisticsInfos));
    }

    return {
        ok: true,
        updates: {
            "alibaba1688.status": status || alibaba.status,
            "alibaba1688.last_synced_at": new Date(),
            "alibaba1688.buyer_view": buyerData,
            "alibaba1688.logistics": logistics,
            ...(map1688StatusToOrderStatus(status)
                ? { orderStatus: map1688StatusToOrderStatus(status) }
                : {}),
        },
    };
};

/**
 * After UZA payment confirmed, relay pay to 1688.
 */
const confirm1688Payment = async (order) => {
    const orderId = order?.alibaba1688?.primary_order_id || order?.alibaba1688?.trade_id;
    if (!orderId) {
        return { ok: false, error: "NO_1688_ORDER_ID" };
    }

    const result = await confirmPayment({ orderId });
    if (!result.ok) {
        return result;
    }

    return {
        ok: true,
        updates: {
            "alibaba1688.status": "WAIT_SELLER_SEND",
            "alibaba1688.payment_confirmed_at": new Date(),
            paymentStatus: "success",
        },
    };
};

module.exports = {
    relayOrderTo1688,
    sync1688OrderState,
    confirm1688Payment,
    buildCargoParamList,
    resolveSpecId,
};
