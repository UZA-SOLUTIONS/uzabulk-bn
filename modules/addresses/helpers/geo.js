"use strict";

const axios = require("axios");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "UzaBulk/1.0 (address reverse-geocode; https://uzabulk.com)";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toAddressLocation = (lattitude, longitude) => {
  const lat = toNumber(lattitude);
  const lng = toNumber(longitude);
  if (lat == null || lng == null) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return {
    type: "Point",
    coordinates: [lng, lat],
  };
};

const toPlain = (doc) => {
  if (!doc) return doc;
  if (typeof doc.toObject === "function") return doc.toObject();
  return { ...doc };
};

const attachLatLng = (doc) => {
  const plain = toPlain(doc);
  if (!plain) return plain;
  const coords = plain.addressLocation?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const longitude = toNumber(coords[0]);
    const lattitude = toNumber(coords[1]);
    if (longitude != null && lattitude != null) {
      plain.longitude = longitude;
      plain.lattitude = lattitude;
    }
  }
  return plain;
};

const attachLatLngMany = (items = []) => (Array.isArray(items) ? items.map(attachLatLng) : items);

const pickArea = (address = {}) =>
  address.suburb
  || address.neighbourhood
  || address.quarter
  || address.city_district
  || address.city
  || address.town
  || address.village
  || address.county
  || address.state
  || "";

const reverseGeocode = async (lattitude, longitude) => {
  const lat = toNumber(lattitude);
  const lng = toNumber(longitude);
  if (lat == null || lng == null) {
    const error = new Error("INVALID_COORDINATES");
    error.statusCode = 400;
    throw error;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error("INVALID_COORDINATES");
    error.statusCode = 400;
    throw error;
  }

  const response = await axios.get(NOMINATIM_URL, {
    params: {
      format: "jsonv2",
      lat,
      lon: lng,
      addressdetails: 1,
    },
    timeout: 8000,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  const payload = response?.data || {};
  return {
    address: payload.display_name || "",
    area: pickArea(payload.address || {}),
    lattitude: lat,
    longitude: lng,
  };
};

module.exports = {
  toAddressLocation,
  attachLatLng,
  attachLatLngMany,
  reverseGeocode,
};
