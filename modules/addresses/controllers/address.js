"use strict";
const AddressServices = require("../services/address");
const { toAddressLocation, attachLatLng, attachLatLngMany, reverseGeocode } = require("../helpers/geo");

const buildAddressPayload = (userId, data) => {
  const setData = {
    user: userId,
    area: data.area,
    name: data.name,
    countryCode: data.countryCode,
    mobileNumber: data.mobileNumber,
    houseNo: data.houseNo,
    landmark: data.landmark,
    address: data.address,
    addressType: data.addressType,
    default: data.default,
  };
  const location = toAddressLocation(data.lattitude, data.longitude);
  if (location) setData.addressLocation = location;
  return setData;
};

module.exports = {
  view: async (req, res) => {
    try {
      const user = req.user;
      const _id = req.params._id;
      const query = { user: user._id, _id, status: { $ne: "archived" } };

      const item = await AddressServices.findOne(query, "-meta_data");

      if (!item) return res.error("NO_RECORD_FOUND");

      return res.success("RECORD_FOUND", attachLatLng(item));
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  list: async (req, res) => {
    try {
      const user = req.user;

      const query = { user: user._id, status: { $ne: "archived" } };

      const items = await AddressServices.list(query, req.paginationOptions);
      let total = await AddressServices.countData(query);

      return res.success(req.nextPageOptions(attachLatLngMany(items), total));
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  reverseGeocode: async (req, res) => {
    try {
      const result = await reverseGeocode(req.query.lat, req.query.lng);
      return res.success("RECORD_FOUND", result);
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  add: async (req, res) => {
    try {
      const address = await AddressServices.create(buildAddressPayload(req.user._id, req.body));
      return res.success("ADDRESS_ADDED", attachLatLng(address));
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  update: async (req, res) => {
    try {
      let user = req.user;
      let _id = req.params._id;

      const hasData = await AddressServices.findOne(
        {
          _id,
          user: user._id,
          status: { $ne: "archived" },
        },
        "_id"
      );

      if (!hasData) {
        return res.error("NO_RECORD_FOUND");
      }

      const address = await AddressServices.update({ _id }, buildAddressPayload(user._id, req.body));

      return res.success("ADDRESS_UPDATED", attachLatLng(address));
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  makeDefaultAddress: async (req, res) => {
    try {
      let user = req.user;
      let _id = req.params._id;

      const hasData = await AddressServices.findOne(
        {
          _id,
          user: user._id,
          status: { $ne: "archived" },
        },
        "_id"
      );

      if (!hasData) {
        return res.error("NO_RECORD_FOUND");
      }

      const address = await AddressServices.update(
        { _id },
        { default: true, user: user._id }
      );

      return res.success("ADDRESS_UPDATED", address);
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  delete: async (req, res) => {
    try {
      let user = req.user;
      let _id = req.params._id;

      await AddressServices.deleteOne({ _id, user: user._id });

      return res.success("Record_DELETED");
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
};
