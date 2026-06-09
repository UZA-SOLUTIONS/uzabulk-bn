const AddressModel = require("../../../models/addressTable");

exports.findOne = function (query = null, select = null) {
  return AddressModel.findOne(query, select).lean();
};

exports.list = function (
  query = null,
  { limit, skip, order, orderBy, search }
) {
  return AddressModel.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ [orderBy]: order })
    .lean();
};

exports.countData = function (query) {
  return AddressModel.countDocuments(query);
};

const removeDefaultAddress = async (data) => {
  if (data?.default)
    await AddressModel.updateMany({ user: data.user }, { default: false });
};

exports.update = async function (query, data) {
  await removeDefaultAddress(data);

  return AddressModel.findOneAndUpdate(query, data, {
    new: true,
    upsert: true,
  });
};

exports.create = async function (data) {
  await removeDefaultAddress(data);

  return AddressModel.create(data);
};

exports.deleteOne = async function (query) {
  const data = await AddressModel.findOne(query, "_id default").lean();
  if (!!data) {
    await AddressModel.updateOne({ _id: data._id }, { status: "archived" });
    if (data.default) {
      const data = await AddressModel.findOne(
        { user: query.user },
        "_id default"
      );
      if (data) {
        data.default = true;
        await data.save();
      }
    }
  } else {
    throw new Error("NO_RECORD_FOUND");
  }
};
