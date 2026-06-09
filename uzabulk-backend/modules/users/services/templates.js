const TemplateModel = require('../../../models/templateTable');

exports.getEmailTemplate = async (type) => {
    return await TemplateModel.findOne({ constant: type }).exec();
}