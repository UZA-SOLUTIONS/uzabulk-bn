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

    addCart: async (req, res, next) => {
        try {
            let body = req.body;

            // Define the schema for the attributes within skuNameValues
            const attributesSchema = Joi.array().items(
                Joi.object({
                    attrId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
                    attrTermId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
                })
            );

            const itemsSchema = Joi.array().items(
                Joi.object().keys({
                    product: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
                    quantity: Joi.number().required().min(1),
                    variation_id: stringAllowNull,
                    attributes: Joi.when('variation_id', {
                        is: Joi.exist(),
                        then: attributesSchema.required(),
                        otherwise: attributesSchema.optional()
                    })
                })
            );

            const mainSchema = Joi.object().keys({
                product: Joi.string().required(),
                items: itemsSchema.required()
            });

            await validateSchema(body, mainSchema);

            next();

        } catch (error) {
            res.error(error);
        }
    },
    isIdValid: async (req, res, next) => {
        try {
            let _id = req.params._id || req.query._id || req.body._id;

            let schema = Joi.object().keys({
                _id: Joi.string().min(15).required(),
            });

            await validateSchema({ _id }, schema);

            next();

        } catch (error) {
            res.error(error);
        }
    },
    updateCart: async (req, res, next) => {
        try {
            let body = req.body;

            // Define the schema for the attributes 
            const attributesSchema = Joi.array().items(
                Joi.object({
                    attrId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
                    attrTermId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
                })
            );

            const itemsSchema = Joi.array().items(
                Joi.object().keys({
                    _id: IdRequired,
                    quantity: Joi.number().min(1).optional(),
                    variation_id: Joi.string().optional(),
                    attributes: Joi.when('variation_id', {
                        is: Joi.exist(),
                        then: attributesSchema.required(),
                        otherwise: attributesSchema.optional()
                    })
                })
            );

            const mainSchema = Joi.object().keys({
                operateType: Joi.string().valid("UPDATE", "MANUAL_DELETED").required(),
                items: itemsSchema.required(),
            });

            await validateSchema(body, mainSchema);

            next();

        } catch (error) {
            res.error(error);
        }
    },
}
