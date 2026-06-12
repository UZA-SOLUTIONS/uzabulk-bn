/**
 * 1688 Trade APIs — cross-border order create, buyer view, payment URL.
 */
const client = require("../../../lib/alibaba1688Client");

const TRADE_NS = "com.alibaba.trade";
const TRADE_ENABLED = () =>
    String(process.env.ALIBABA_TRADE_ENABLED || "true").toLowerCase() !== "false";

const getTradeFlow = () => process.env.ALIBABA_TRADE_FLOW || "general";
const getIsvBizType = () => process.env.ALIBABA_TRADE_ISV_BIZ_TYPE || "cross";

const tradePath = (apiName) => client.urlPath(TRADE_NS, apiName);

/**
 * Build China consolidation / warehouse address for 1688 cross-border orders.
 * African buyer addresses are stored separately on the UZA order.
 */
const buildWarehouseAddressParam = () => ({
    provinceText: process.env.ALIBABA_TRADE_WAREHOUSE_PROVINCE || "浙江省",
    cityText: process.env.ALIBABA_TRADE_WAREHOUSE_CITY || "杭州市",
    areaText: process.env.ALIBABA_TRADE_WAREHOUSE_AREA || "滨江区",
    townText: process.env.ALIBABA_TRADE_WAREHOUSE_TOWN || "",
    address: process.env.ALIBABA_TRADE_WAREHOUSE_ADDRESS || "网商路699号",
    postCode: process.env.ALIBABA_TRADE_WAREHOUSE_POSTCODE || "310000",
    fullName: process.env.ALIBABA_TRADE_WAREHOUSE_CONTACT || "UZA Bulk Warehouse",
    mobile: process.env.ALIBABA_TRADE_WAREHOUSE_MOBILE || "13800000000",
    phone: process.env.ALIBABA_TRADE_WAREHOUSE_PHONE || process.env.ALIBABA_TRADE_WAREHOUSE_MOBILE || "13800000000",
    districtCode: process.env.ALIBABA_TRADE_WAREHOUSE_DISTRICT_CODE || "330108",
});

/**
 * @param {{ thirdOrderId: string, cargoParamList: Array, message?: string, addressParam?: object }} orderInput
 */
const createCrossOrder = async (orderInput) => {
    if (!TRADE_ENABLED()) {
        return { ok: false, error: "ALIBABA_TRADE_DISABLED", data: null };
    }

    const createOrderParam = {
        flow: getTradeFlow(),
        isvBizType: getIsvBizType(),
        thirdOrderId: String(orderInput.thirdOrderId),
        message: orderInput.message || "UZA Bulk cross-border order",
        addressParam: orderInput.addressParam || buildWarehouseAddressParam(),
        cargoParamList: orderInput.cargoParamList,
    };

    const urlPath = tradePath("alibaba.trade.createCrossOrder");
    const result = await client.post(urlPath, {
        createOrderParam: JSON.stringify(createOrderParam),
    });

    if (!result.ok) {
        return { ok: false, error: result.error, data: result.data, raw: result.raw };
    }

    return { ok: true, data: result.data, raw: result.raw };
};

/**
 * @param {string|number} orderId — 1688 order id
 */
const getBuyerOrderView = async (orderId) => {
    const urlPath = tradePath("alibaba.trade.get.buyerView");
    const result = await client.post(urlPath, {
        webSite: "1688",
        orderId: String(orderId),
    });
    return result;
};

/**
 * Payment URL for unpaid 1688 orders (跨境宝 / Alipay).
 * @param {string|number} orderId
 */
const getPaymentUrl = async (orderId) => {
    const urlPath = tradePath("alibaba.alipay.url.get");
    const result = await client.post(urlPath, {
        orderId: String(orderId),
    });
    return result;
};

/**
 * Confirm payment on 1688 after UZA payment gateway success.
 * @param {{ orderId: string, payChannel?: string }} opts
 */
const confirmPayment = async ({ orderId, payChannel = "alipay" }) => {
    const urlPath = tradePath("alibaba.trade.pay");
    const result = await client.post(urlPath, {
        orderId: String(orderId),
        payChannel: String(payChannel),
    });
    return result;
};

const map1688StatusToOrderStatus = (status) => {
    const normalized = String(status || "").toUpperCase();
    const map = {
        WAIT_BUYER_PAY: "pending",
        WAIT_PAY: "pending",
        WAIT_SELLER_SEND: "confirmed",
        WAIT_BUYER_RECEIVE: "inroute",
        WAIT_CONFIRM: "inroute",
        CONFIRM: "inroute",
        SUCCESS: "completed",
        CANCEL: "cancelled",
        TERMINATED: "cancelled",
    };
    return map[normalized] || null;
};

const extractTradeIds = (createResponse) => {
    const data = createResponse?.data || createResponse || {};
    const orderIds = [];

    if (data.orderId) orderIds.push(String(data.orderId));
    if (data.orderList) {
        for (const o of data.orderList) {
            if (o?.orderId) orderIds.push(String(o.orderId));
        }
    }
    if (data.result?.orderId) orderIds.push(String(data.result.orderId));

    const tradeId = data.tradeId || data.trade_id || orderIds[0] || null;
    return { tradeId, orderIds, raw: data };
};

module.exports = {
    TRADE_ENABLED,
    createCrossOrder,
    getBuyerOrderView,
    getPaymentUrl,
    confirmPayment,
    buildWarehouseAddressParam,
    map1688StatusToOrderStatus,
    extractTradeIds,
};
