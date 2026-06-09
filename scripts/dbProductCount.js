require("dotenv").config();

// Backend uses global env from config/env in many modules.
// This script is a quick sanity check for product presence.
global.env = require("../config/env");

const mongoose = require("mongoose");
const Product = require("../models/productsTable");
const Category = require("../models/categoryTable");

async function main() {
  const uri = String(env.mongoAtlasUri || "").trim();
  if (!uri) {
    throw new Error("Missing env.mongoAtlasUri");
  }

  await mongoose.connect(uri);

  const productTotal = await Product.countDocuments({});
  const productByStatus = await Product.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const categoryTotal = await Category.countDocuments({});
  const categoryByStatus = await Category.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(
    JSON.stringify(
      {
        mongoAtlasUri: uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"),
        products: { total: productTotal, byStatus: productByStatus },
        categories: { total: categoryTotal, byStatus: categoryByStatus },
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

