const { translateProductNamesToFrench } = require("../translationService");

const MAX_BATCH = 40;

module.exports = {
    translateProducts: async (req, res) => {
        try {
            const locale = String(req.getLocale?.() || req.headers["accept-language"] || "en").slice(0, 2);
            if (locale !== "fr") {
                return res.success("PRODUCT_NAMES_TRANSLATED", { translations: {} });
            }

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
            return res.error(error?.message || "TRANSLATION_FAILED");
        }
    },
};
