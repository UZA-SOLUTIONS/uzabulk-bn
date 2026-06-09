const mongoose = require("mongoose");

const productBehaviorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deviceId: { type: String, default: "" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    offerId: { type: String, default: "" },
    eventType: {
      type: String,
      enum: ["view", "search", "add_to_cart", "update_cart", "checkout", "order"],
      required: true,
    },
    score: { type: Number, default: 1 },
    search: { type: String, default: "" },
    metadata: { type: Object, default: {} },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  }
);

productBehaviorSchema.index({ user: 1, created_at: -1 }, { name: "behavior_user_recent" });
productBehaviorSchema.index({ deviceId: 1, created_at: -1 }, { name: "behavior_device_recent" });
productBehaviorSchema.index({ product: 1, eventType: 1 }, { name: "behavior_product_event" });

module.exports = mongoose.model("ProductBehavior", productBehaviorSchema);
