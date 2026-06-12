/**
 * 1688 Logistics — buyer-view trace info and logistics companies.
 */
const client = require("../../../lib/alibaba1688Client");

const TRADE_NS = "com.alibaba.trade";

const tradePath = (apiName) => client.urlPath(TRADE_NS, apiName);

/**
 * Logistics trace events for a 1688 order (buyer view).
 * @param {string|number} orderId — 1688 order id
 * @param {string} [logisticsId]
 */
const getLogisticsTrace = async (orderId, logisticsId = "") => {
    const params = {
        orderId: String(orderId),
        webSite: "1688",
    };
    if (logisticsId) {
        params.logisticsId = String(logisticsId);
    }

    const urlPath = tradePath("alibaba.trade.getLogisticsTraceInfo.buyerView");
    return client.post(urlPath, params);
};

/**
 * Logistics shipment list for an order.
 * @param {string|number} orderId
 */
const getLogisticsInfos = async (orderId) => {
    const urlPath = tradePath("alibaba.trade.getLogisticsInfos.buyerView");
    return client.post(urlPath, {
        orderId: String(orderId),
        webSite: "1688",
    });
};

/**
 * Normalize trace response to UZA schema.
 */
const normalizeLogisticsTrace = (tracePayload) => {
    const root = tracePayload?.data || tracePayload || {};
    const logisticsList = root.logisticsTraceInfos
        || root.logisticsTraceInfo
        || root.traceList
        || [];

    const traces = Array.isArray(logisticsList) ? logisticsList : [logisticsList];

    return traces.map((entry) => {
        const events = entry?.logisticsSteps
            || entry?.traceList
            || entry?.steps
            || [];

        return {
            company_name: entry?.logisticsCompanyName || entry?.companyName || "",
            logistics_company_code: entry?.logisticsCompanyNo || entry?.logisticsCode || "",
            waybill_number: entry?.logisticsBillNo || entry?.waybillNumber || "",
            delivery_status: entry?.status || entry?.deliveryStatus || "IN_TRANSIT",
            trace_list: (Array.isArray(events) ? events : []).map((step) => ({
                time: step?.acceptTime || step?.time || step?.gmtCreate || "",
                location: step?.remark || step?.location || step?.acceptAddress || "",
                status_desc: step?.remark || step?.statusDesc || step?.status || "",
            })),
            last_updated_at: new Date(),
        };
    });
};

module.exports = {
    getLogisticsTrace,
    getLogisticsInfos,
    normalizeLogisticsTrace,
};
