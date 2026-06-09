const ContentPagesTable = require("../../../models/contentPagesTable");
const SectionTable = require("../../../models/sectionTable");

module.exports = {
  getContent: async (query = null) => {
    return ContentPagesTable.findOne(query)
      .populate({
        path: 'sections',
        populate: {
          path: 'banner multipleContent.banner'
        },
        options: { sort: 'sortOrder' }
      });
  }
}
