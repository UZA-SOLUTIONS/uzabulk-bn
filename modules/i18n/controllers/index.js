const { translateProductNamesToFrench, translateProductDetailFieldsToFrench } = require("../translationService");

const MAX_BATCH = 40;
const MAX_DETAIL_FIELDS = 400;

module.exports = {
    translateProducts: async (req, res) => {
        try {
            const items = Array.isArray(req.body?.items) ? req.body.items : [];
            if (!items.length) {
                return res.success("PRODUCT_NAMES_TRANSLATED", { translations: {} });
            }

            const batch = items
                .slice(0, MAX_BATCH)
                .map((item) => ({
                    id: String(item?.id || "").trim(),
                    name: String(item?.name || "").trim(),
                }))
                .filter((item) => item.id && item.name);

            const translations = await translateProductNamesToFrench(batch);
            return res.success("PRODUCT_NAMES_TRANSLATED", { translations });
        } catch (error) {
            console.error("i18n.translateProducts", error);
            return res.success("PRODUCT_NAMES_TRANSLATED", { translations: {} });
        }
    },

    translateProductDetail: async (req, res) => {
        try {
            const productId = String(req.body?.productId || "").trim();
            const fields = req.body?.fields && typeof req.body.fields === "object"
                ? req.body.fields
                : {};

            if (!productId || !Object.keys(fields).length) {
                return res.success("PRODUCT_DETAIL_TRANSLATED", { translations: {} });
            }

            const limited = {};
            Object.entries(fields).slice(0, MAX_DETAIL_FIELDS).forEach(([key, value]) => {
                const k = String(key || "").trim();
                const v = String(value || "").trim();
                if (k && v) limited[k] = v;
            });

            const targetLang = String(req.body?.targetLang || "fr").toLowerCase().startsWith("en")
                ? "en"
                : "fr";

            const translations = await translateProductDetailFieldsToFrench(productId, limited, targetLang);
            return res.success("PRODUCT_DETAIL_TRANSLATED", { translations });
        } catch (error) {
            console.error("i18n.translateProductDetail", error);
            return res.success("PRODUCT_DETAIL_TRANSLATED", { translations: {} });
        }
    },
};
