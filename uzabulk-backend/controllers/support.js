const { INSERT_DATA, FETCH_ONE, } = require("../services");
const _ = require('lodash');
module.exports = {

    supportRequest: async (req, res) => {
        try {
            let user = req.user;
            let body = req.body;

            _.extend(body, { user_id: user.id });

            await INSERT_DATA(_tables.SUPPORTS, body);

            return res.success("Request submitted successfully!", {});

        } catch (error) {
            res.error(error);
        }
    }
}