const Joi = require('joi');
const { IdRequired, stringAllowNull } = require('../../../helpers/validationHelper');
const validateSchema = async (inputs, schema) => {
    try {
        const { error, value } = schema.validate(inputs);
        if (error) throw error.details ? error.details[0].message.replace(/['"]+/g, "") : "";
        else return false;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

module.exports = {
    isIdValid: async (req, res, next) => {
        try {
            let _id = req.params._id || req.query._id || req.body._id;

            let schema = Joi.object().keys({
                _id: IdRequired
            });

            await validateSchema({ _id }, schema);

            next();

        } catch (error) {
            res.error(error);
        }
    },
    // PlaceOrder: async (req, res, next) => {
    //     try {
    //         let body = req.body;

    //         let schema = Joi.object().keys({
    //             product: Joi.number().required(),
    //             quantity: Joi.number().required(),
    //         });

    //         await validateSchema(body, schema);

    //         next();

    //     } catch (error) {
    //         res.error(error);
    //     }
    // },
    checkout: async (req, res, next) => {
        try {
            let body = req.body;

            const mainSchema = Joi.object().keys({
                cart_ids: Joi.array().items(IdRequired).unique().required(),
                coupon: Joi.string().optional().min(3).allow(""),
                shipping_address: stringAllowNull,
                billing_address: stringAllowNull,
            });

            await validateSchema(body, mainSchema);

            next();

        } catch (error) {
            res.error(error);
        }
    },

    placeOrder: async (req, res, next) => {
        try {
            let body = req.body;

            const mainSchema = Joi.object().keys({
                cart_ids: Joi.array().items(IdRequired).unique().required(),
                coupon: Joi.string().optional().min(3).allow(""),
                shipping_address: IdRequired,
                billing_address: IdRequired,
            });

            await validateSchema(body, mainSchema);

            next();

        } catch (error) {
            res.error(error);
        }
    },

}