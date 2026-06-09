const { FETCH_ALL, FETCH_ONE, } = require("../services");
const _ = require('lodash');
module.exports = {

    viewPage: async (req, res) => {
        try {

            let { slug } = req.params;

            let conditions = {
                slug: { operator: '=', value: slug },
                status: { operator: '=', value: "active" },
            };
            let columns = ["id", "title", "slug", "content"];
            let result = await FETCH_ONE(_tables.CONTENT_PAGES, conditions, columns);

            if (_.isEmpty(result)) {
                return res.error("Not found");
            };
            return res.success("Data success", result);

        } catch (error) {
            res.error(error);
        }
    },
    pageList: async (req, res) => {
        try {

            let conditions = {
                status: { operator: '=', value: "active" },
            };
            let columns = ["id", "title", "slug", "content"];

            let result = await FETCH_ALL(_tables.CONTENT_PAGES, conditions, columns);

            if (_.isEmpty(result)) {
                return res.error("Not found");
            };
            return res.success("Data success", result);

        } catch (error) {
            res.error(error);
        }
    },
    FAQList: async (req, res) => {
        try {

            let conditions = {
                status: { operator: '=', value: "active" },
            };
            let columns = ["id", "question", "answer"];

            let result = await FETCH_ALL(_tables.FAQ, conditions, columns);

            if (_.isEmpty(result)) {
                return res.error("Not found");
            };
            return res.success("Data success", result);

        } catch (error) {
            res.error(error);
        }
    },
}