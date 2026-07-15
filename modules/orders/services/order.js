const { default: mongoose } = require("mongoose");
const moment = require("moment");
const ejs = require("ejs");
const path = require("path");
let Order = require("../../../models/ordersTable");
let User = require("../../../models/userTable");
const TemplateServices = require("./templates");
const ProductServices = require("./product");
const { sendEmail } = require("../../../lib/ses");
const { toFixedNumber } = require("../helper");

const templateDirectory = path.join(__dirname, "../../../public/emailTemplates");

let sendEmailToUser = async ({ user, orders }) => {
  const template = await TemplateServices.getEmailTemplate("CUSTOMER_ORDER_COMPLETED");
  if (template) {
    // Prepare the data for the EJS template
    const data = {
      orders,
      moment,
    };

    // Render the EJS template
    const productHTML = await ejs.renderFile(path.join(templateDirectory, "userProducts.ejs"), data);

    // Replace placeholders in the email template
    template.body = template.body.replaceAll("[DATE]", moment().format('ddd DD MMMM'));
    template.body = template.body.replaceAll("[PRODUCT_DETAILS]", productHTML);

    // Send the email
    sendEmail(user.email, template.subject, template.body);
  }
};



let sendEmailToVendor = async ({ vendor, user, orders }) => {
  const template = await TemplateServices.getEmailTemplate("CUSTOMER_STORE_ORDER_COMPLETED");
  if (template) {
    // Prepare the data for the EJS template
    const data = {
      orders,
      moment,
    };

    // Render the EJS template
    const productHTML = await ejs.renderFile(path.join(templateDirectory, "userProducts.ejs"), data);

    const totalAmount = orders.reduce((total, order) => order.orderTotal + total, 0);

    // Replace placeholders in the email template
    template.body = template.body.replaceAll("[DATE]", moment().format('ddd DD MMMM'));
    template.body = template.body.replaceAll("[PRODUCT_DETAILS]", productHTML);
    template.body = template.body.replaceAll("[CUSTOMER_NAME]", user?.name || "");
    template.body = template.body.replaceAll("[CUSTOMER_EMAIL]", user?.email || "");
    template.body = template.body.replaceAll("[CUSTOMER_PHONE]", `${user?.countryCode || ""} ${user?.mobileNumber || ""}`);
    template.body = template.body.replaceAll("[TOTAL_AMOUNT]", toFixedNumber(totalAmount));

    // Send the email
    sendEmail("uza.vendor@yopmail.com", template.subject, template.body);
    sendEmail("jaswinder.suffescom@gmail.com", template.subject, template.body);
    // sendEmail(vendor.email, template.subject, template.body);
  }
};


const filterVendorOrders = async ({ user, orders }) => {
  let ordersByVendor = {};
  for (const order of orders) {
    if (ordersByVendor[order.vendor.toString()])
      ordersByVendor[order.vendor.toString()].push(order);
    else
      ordersByVendor[order.vendor.toString()] = [order];
  }

  for (const vendor in ordersByVendor) {
    let vendorData = await User.findById(vendor);
    sendEmailToVendor({ vendor: vendorData, user, orders: ordersByVendor[vendor] });
  }
}

let sendOrderEmails = async ({ user, orders }) => {
  sendEmailToUser({ user, orders });
  filterVendorOrders({ user, orders });
}

let updateProductStocks = async (orders) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const order of orders) {
      order._id;

      for (const item of order?.line_items) {
        if (item?.variation_id) {
          await ProductServices.updateVariationStock(item.variation_id, item.quantity, session);
        }
        else {
          await ProductServices.updateProductStock(item.product, item.quantity, session);
        }
      }
    }

    await session.commitTransaction();
    await session.endSession();
  }
  catch (error) {
    await session.abortTransaction();
    await session.endSession();
  }
}

let addOrder = (data) => {
  data.date_modified_utc = new Date();
  return Order.create(data);
};

let createMany = (data) => {
  for (let i = 0; i < data.length; i++) {
    data[i].date_modified_utc = new Date();
  }
  return Order.insertMany(data);
};

let countData = (query) => {
  return Order.countDocuments(query);
};

let list = (query = null, { limit, skip, order, orderBy, search }) => {
  return Order.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ [orderBy]: order })
    .lean();
};


let orderById = (_id) => {
  return Order.findById(_id).lean();
};

/** Public lookup by Mongo id or customOrderId (no sign-in required). */
let findForTrack = (rawQuery, userId = null) => {
  const q = String(rawQuery || "").trim();
  if (!q) return null;

  const filter = {};
  if (userId) {
    // Prefer the signed-in user's order when logged in.
    filter.user = userId;
  }

  if (mongoose.isValidObjectId(q)) {
    filter.$or = [{ _id: q }, { customOrderId: q }];
  } else {
    filter.customOrderId = {
      $regex: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    };
  }

  return Order.findOne(filter).lean();
};

module.exports = { addOrder, countData, list, sendOrderEmails, updateProductStocks, createMany, orderById, findForTrack };
