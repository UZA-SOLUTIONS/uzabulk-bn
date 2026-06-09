const moment = require("moment");
const UserModel = require("../../../models/userTable");
const CartModel = require("../../../models/cartTable");
const OTPModel = require("../../../models/otp");
const utils = require("../../../utils");
const AUTH_ROLES = [env.ROLE, env.RETAILER_ROLE].filter(Boolean);

const isValidOtp = (data, otp, del = true) => {
  if (!data) throw new Error("OTP_USED");

  if (otp.toString() !== data.otp.toString())
    throw new Error("OTP_NOT_MATCHED");

  if (moment().isAfter(moment(data.otpExpires)))
    throw new Error("VERIFICATION_CODE_EXPIRED");

  if (del) OTPModel.deleteOne({ _id: data._id }).exec();
};

exports.emailOtp = async (email, otp, del = true) => {
  const data = await OTPModel.findOne({ email: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .exec();
  isValidOtp(data, otp, del);
};

exports.mobileOtp = async (mobileNumber, countryCode, otp, del = true) => {
  const data = await OTPModel.findOne({ mobileNumber, countryCode })
    .sort({ createdAt: -1 })
    .exec();
  isValidOtp(data, otp, del);
};

exports.createOtp = async (data) => {
  const otp = String(utils.generateOTP(4));
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  await OTPModel.deleteMany(data);
  await OTPModel.create({
    ...data,
    otp: otp,
    otpExpires: date,
  });
  return otp;
};

exports.findOne = async (query, select = null) => {
  return await UserModel.findOne(query, select);
};

exports.findOneWithProfileImage = async (query, select = null) => {
  return UserModel.findOne(query, select).populate("profileImage").exec();
};

// Email exists or not
exports.emailExist = async function (email) {
  const exists = await UserModel.findOne({
    email: email.toLowerCase(),
    role: { $in: AUTH_ROLES },
    status: { $nin: ["archived"] },
  }).exec();

  return exists !== null;
};

// Mobile no exists or not
exports.mobileNumberExist = async function (mobileNumber, countryCode) {
  const exists = await UserModel.findOne({
    mobileNumber: mobileNumber,
    countryCode: countryCode,
    role: { $in: AUTH_ROLES },
    status: { $nin: ["archived"] },
  }).exec();

  return exists !== null;
};

// Login user
exports.login = async function (data) {
  const email = String(data?.email || "").trim().toLowerCase();
  const password = String(data?.password || "");

  const scopedQuery = {
    role: { $in: AUTH_ROLES },
    status: { $ne: "archived" },
    email,
  };

  let user = await UserModel.findOne(scopedQuery);
  if (!user) {
    // Legacy accounts may have different role casing/values; fallback to email-only lookup.
    user = await UserModel.findOne({
      email,
      status: { $ne: "archived" },
    });
  }

  // Only registered users with active accounts can login.
  if (!user || !user.email) throw new Error("USER_NOT_FOUND");

  if (user.status === "blocked") throw new Error("ACCOUNT_BLOCKED");
  if (!user.password || !password) throw new Error("INCORRECT_PASSWORD");

  let isValid = await utils.verifyPassword(user.password, password);
  if (!isValid) throw new Error("INCORRECT_PASSWORD");

  await user.populate("profileImage");

  const token = utils.generateToken(user);
  await user.save();

  return { user, token };
};

// Find by email
exports.findByEmail = async function (
  email,
  notIn = ["archived"],
  select = null,
  query = {}
) {
  return await UserModel.findOne(
    {
      email: email.toLowerCase(),
      status: { $nin: notIn },
      ...query,
    },
    select
  ).exec();
};

// Find by mobile number
exports.findByMobileNumber = async function (
  mobileNumber,
  countryCode,
  notIn = ["archived"],
  select = null,
  query = {}
) {
  return await UserModel.findOne(
    {
      mobileNumber: mobileNumber,
      countryCode,
      status: { $nin: notIn },
      ...query,
    },
    select
  ).exec();
};

// Update or create
exports.update = async function (query, data) {
  return await UserModel.findOneAndUpdate(query, data, {
    new: true,
    upsert: true,
  });
};

exports.create = async function (data) {
  const user = new UserModel(data);
  await user.save();
  return user;
};


exports.mergeCart = async function (user, deviceId) {
  const deviceCart = await CartModel.find({ deviceId, cartType: "temp" });
  if (deviceCart) {
    const userCart = await CartModel.find({ user });
    if (userCart) { // Merge cart
      for (const cartItem of deviceCart) {
        const hasUserCart = userCart.find((item) => item.product.toString() === cartItem.product.toString());
        if (hasUserCart) {
          for (const item of cartItem.items) {
            const userCartIndex = hasUserCart.items.findIndex(userItem => !userItem.variation_id || userItem.variation_id.toString() === item.variation_id.toString());
            if (userCartIndex !== -1) {
              hasUserCart.items[userCartIndex].quantity += item.quantity;
              hasUserCart.items[userCartIndex].amount += item.unitPrice * hasUserCart.items[userCartIndex].quantity;
            }
            else {
              hasUserCart.items.push(item);
            }
          }
          await CartModel.updateOne({ _id: hasUserCart._id }, {
            subTotal: hasUserCart.subTotal + cartItem.subTotal,
            items: hasUserCart.items,
            cartType: "default",
          }).exec();
        }
        else {
          await CartModel.updateOne({ _id: cartItem._id }, { user, cartType: "default" }).exec();
        }
      }

      await CartModel.deleteMany({ deviceId, cartType: "temp" }).exec();
    }
    else {
      await CartModel.updateMany({ _id: { $in: deviceCart.map((cart) => cart._id) } }, { user, cartType: "default" }).exec();
    }
  }
}