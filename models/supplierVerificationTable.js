const mongoose = require("mongoose");

const VERIFICATION_STATUS = ["VERIFIED", "PENDING", "FLAGGED"];
const RISK_FLAGS = ["low_stock", "new_supplier", "high_dispute"];
const RECOMMENDED_FOR = ["bulk_orders", "sample_only"];

const supplierVerificationSchema = new mongoose.Schema(
    {
        member_id: { type: String, required: true, trim: true, unique: true },
        sellerOpenId: { type: String, trim: true, default: "" },
        seller_id: { type: String, trim: true, default: "" },
        supplier_id: { type: String, trim: true, default: "" },

        company_name: { type: String, trim: true, default: "" },
        business_license_no: { type: String, trim: true, default: "" },
        registered_capital: { type: Number, default: null },
        years_on_platform: { type: Number, default: null },
        credit_level: { type: String, trim: true, default: "" },

        transaction_count_90d: { type: Number, default: null },
        dispute_rate: { type: Number, default: null },
        on_time_delivery_rate: { type: Number, default: null },
        product_categories: { type: [String], default: [] },

        trust_score: { type: Number, min: 0, max: 100, default: 0 },
        verification_status: {
            type: String,
            enum: VERIFICATION_STATUS,
            default: "PENDING",
        },
        risk_flags: {
            type: [{ type: String, enum: RISK_FLAGS }],
            default: [],
        },
        recommended_for: {
            type: [{ type: String, enum: RECOMMENDED_FOR }],
            default: [],
        },
        display_badge: { type: String, trim: true, default: "" },
        manual_review_required: { type: Boolean, default: false },

        integration_type: { type: String, default: "api" },
        last_verified_at: { type: Date, default: null },
        next_refresh_at: { type: Date, default: null },

        raw_member: { type: mongoose.Schema.Types.Mixed, default: null },
        raw_company: { type: mongoose.Schema.Types.Mixed, default: null },
        last_error: { type: String, trim: true, default: "" },
    },
    { versionKey: false, timestamps: true }
);

supplierVerificationSchema.index({ member_id: 1 }, { unique: true });
supplierVerificationSchema.index({ verification_status: 1, trust_score: -1 });
supplierVerificationSchema.index({ next_refresh_at: 1 });
supplierVerificationSchema.index({ supplier_id: 1 });

module.exports = mongoose.model("SupplierVerification", supplierVerificationSchema);
module.exports.VERIFICATION_STATUS = VERIFICATION_STATUS;
module.exports.RISK_FLAGS = RISK_FLAGS;
module.exports.RECOMMENDED_FOR = RECOMMENDED_FOR;
