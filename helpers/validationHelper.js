const Joi = require('joi');
const logger = require('../config/logger');

const validateSchema = (req, schema) => {
    const validation = schema.validate(req);
    if (validation.error) {
        let errorName = validation.error.name;
        let errorReason =
            validation.error.details !== undefined
                ? validation.error.details[0].message.replace(/['"]+/g, "")
                : 'Parameter missing or parameter type is wrong';


        throw errorReason;
    }
    return true;
}

const password = (value, helpers) => {
    if (value.length < 6) {
        return helpers.message('Password must be at least 6 characters');
    }
    if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
        return helpers.message('Password must contain at least 1 letter and 1 number');
    }
    return value;
};

const objectId = (value, helpers) => {
    if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message('"{{#label}}" must be a valid mongo id');
    }
    return value;
};

exports.arrayRequired = Joi.array();

exports.emailRequired = Joi.string().required().email();

exports.emailOptional = Joi.string().allow(null, "").optional().email();

exports.stringRequired = Joi.string().required();

exports.stringOptional = Joi.string().optional();

exports.stringAllowNull = Joi.string().allow('', null).optional();

exports.numberRequired = Joi.number().required();

exports.numberOptional = Joi.number().optional();

exports.validObjectId = Joi.string().required().custom(objectId);

exports.passwordRequired = Joi.string().required().custom(password);

exports.passwordOptional = Joi.string().required().allow(null, '').custom(password);

exports.booleanRequired = Joi.boolean().required();
exports.booleanOptional = Joi.boolean().allow("", null).optional();
exports.IdRequired = Joi.string().regex(/^[0-9a-fA-F]{24}$/).required();

exports.confirmPasswordRequired = (field = 'password') => Joi.ref(field);

exports.stringRequiredValid = (...values) => Joi.string().valid(...values).required();

exports.stringOptionalValid = (...values) => Joi.string().valid(...values).optional();

exports.validateWhen = (field, value, then, otherwise) => Joi.when(field, {
    is: value,
    then: then,
    otherwise: otherwise,
});

exports.validateRequest = (requestData, object) => {

    logger.info({
        where: 'validation schema',
        message: 'Request body',
        REQUEST_BODY: requestData
    });

    const schema = Joi.object().keys(object);

    return validateSchema(requestData, schema);
}