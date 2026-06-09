"use strict";
const PageService = require("../services");

module.exports = {
  getContentByConstant: async (req, res) => {
    try {
      let path = req.path.replace('/', '').trim();
      let obj = { status: "active" };
      switch (path) {
        case 'aboutUs':
          obj.type = 'ABOUT_US';
          break;
        case 'contactUs':
          obj.type = 'CONTACT_US';
          break;
        case 'termAndConditions':
          obj.type = env.RETAILER_ROLE + '_TERMS_CONDITIONS';
          break;
        case 'privacyPolicy':
          obj.type = 'PRIVACY_POLICY';
          break;
        default:
          obj.type = "OTHER";
      }

      const result = await PageService.getContent(obj);

      return res.success("RECORD_FOUND", result);
    } catch (error) {
      res.json(helper.showInternalServerErrorResponse('INTERNAL_SERVER_ERROR'));
    }
  },
}