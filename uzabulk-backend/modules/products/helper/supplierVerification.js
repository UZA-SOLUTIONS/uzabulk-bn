const REFRESH_DAYS = Number(process.env.SUPPLIER_VERIFICATION_REFRESH_DAYS || 30);
const MANUAL_REVIEW_THRESHOLD = Number(process.env.SUPPLIER_VERIFICATION_MANUAL_THRESHOLD || 60);

const firstString = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return "";
};

const firstNumber = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null || value === "") continue;
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return null;
};

const parsePercent = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "string" && value.includes("%")) {
        const n = Number(value.replace("%", "").trim());
        return Number.isFinite(n) ? n : null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n > 0 && n <= 1) return Math.round(n * 1000) / 10;
    return n;
};

const parseCategories = (value) => {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 20);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(/[;,|]/)
            .map((v) => v.trim())
            .filter(Boolean)
            .slice(0, 20);
    }
    return [];
};

const normalizeCreditLevel = (raw) => {
    const text = firstString(raw).toLowerCase();
    if (!text) return "";
    if (text.includes("diamond") || text.includes("钻石")) return "Diamond";
    if (text.includes("gold") || text.includes("金")) return "Gold";
    if (text.includes("silver") || text.includes("银")) return "Silver";
    return firstString(raw);
};

/**
 * Map alibaba.member.get + product-detail seller blobs into UZA verification fields.
 */
const normalizeSupplierApiPayload = ({ member = {}, company = {}, productDetails = {} } = {}) => {
    const sellerData =
        productDetails.sellerDataInfo
        || productDetails.sellerData
        || productDetails.sellerInfo
        || {};

    const merged = { ...sellerData, ...member, ...company };

    const member_id = firstString(
        member.memberId,
        member.member_id,
        member.loginId,
        member.login_id,
        sellerData.memberId,
        sellerData.sellerOpenId,
        productDetails.sellerOpenId
    );

    const company_name = firstString(
        company.companyName,
        company.company_name,
        company.name,
        member.companyName,
        sellerData.companyName,
        sellerData.shopName,
        productDetails.companyName
    );

    const business_license_no = firstString(
        company.businessLicenseNo,
        company.business_license_no,
        company.regCode,
        company.registrationNumber,
        company.unifiedSocialCreditCode
    );

    const registered_capital = firstNumber(
        company.registeredCapital,
        company.registered_capital,
        company.regCapital,
        company.capital
    );

    const years_on_platform = firstNumber(
        member.yearsOnPlatform,
        member.years_on_platform,
        member.platformYears,
        company.yearsOn1688,
        sellerData.yearsOnPlatform
    );

    const credit_level = normalizeCreditLevel(
        firstString(
            member.creditLevel,
            member.credit_level,
            member.tradeMedalLevel,
            sellerData.creditLevel,
            company.creditLevel
        )
    );

    const transaction_count_90d = firstNumber(
        member.transactionCount90d,
        member.transaction_count_90d,
        member.orderCount90d,
        member.tradeCount90d,
        sellerData.transactionCount90d,
        sellerData.orderCount90d
    );

    const dispute_rate = parsePercent(
        firstNumber(
            member.disputeRate,
            member.dispute_rate,
            sellerData.disputeRate,
            company.disputeRate
        )
    );

    const on_time_delivery_rate = parsePercent(
        firstNumber(
            member.onTimeDeliveryRate,
            member.on_time_delivery_rate,
            member.deliveryRate,
            sellerData.onTimeDeliveryRate,
            sellerData.deliveryRate,
            company.onTimeDeliveryRate
        )
    );

    const product_categories = parseCategories(
        company.productCategories
            || company.product_categories
            || member.productCategories
            || sellerData.mainCategories
            || sellerData.productCategories
    );

    return {
        member_id,
        company_name,
        business_license_no,
        registered_capital,
        years_on_platform,
        credit_level,
        transaction_count_90d,
        dispute_rate,
        on_time_delivery_rate,
        product_categories,
        _hasApiData: Boolean(member_id && (company_name || member.memberId || company.companyName)),
    };
};

const computeTrustScore = (fields = {}) => {
    let score = 45;

    const credit = String(fields.credit_level || "").toLowerCase();
    if (credit === "diamond") score += 22;
    else if (credit === "gold") score += 16;
    else if (credit === "silver") score += 10;

    const years = fields.years_on_platform;
    if (years != null) {
        score += Math.min(15, Math.max(0, years) * 2);
    }

    const onTime = fields.on_time_delivery_rate;
    if (onTime != null) {
        score += Math.min(20, (onTime / 100) * 20);
    }

    const disputes = fields.dispute_rate;
    if (disputes != null) {
        score -= Math.min(35, (disputes / 100) * 70);
    }

    const tx90 = fields.transaction_count_90d;
    if (tx90 != null) {
        if (tx90 >= 200) score += 12;
        else if (tx90 >= 50) score += 8;
        else if (tx90 >= 10) score += 4;
        else if (tx90 < 5) score -= 8;
    }

    const capital = fields.registered_capital;
    if (capital != null) {
        if (capital >= 5_000_000) score += 8;
        else if (capital >= 1_000_000) score += 5;
        else if (capital >= 100_000) score += 2;
    }

    if (fields.business_license_no) score += 5;
    if ((fields.product_categories || []).length >= 3) score += 3;

    return Math.max(0, Math.min(100, Math.round(score)));
};

const deriveRiskFlags = (fields = {}, trustScore = 0) => {
    const flags = [];

    const years = fields.years_on_platform;
    const tx90 = fields.transaction_count_90d;
    if ((years != null && years < 1) || (tx90 != null && tx90 < 10)) {
        flags.push("new_supplier");
    }

    if (fields.dispute_rate != null && fields.dispute_rate >= 8) {
        flags.push("high_dispute");
    }

    if (trustScore < 50) {
        flags.push("low_stock");
    }

    return [...new Set(flags)];
};

const deriveRecommendedFor = (fields = {}, trustScore = 0, riskFlags = []) => {
    const recommended = [];
    if (trustScore >= 65 && !riskFlags.includes("high_dispute")) {
        recommended.push("bulk_orders");
    }
    if (trustScore < 55 || riskFlags.includes("new_supplier")) {
        recommended.push("sample_only");
    }
    if (!recommended.length) recommended.push("sample_only");
    return recommended;
};

const deriveVerificationStatus = (trustScore, riskFlags = [], hasApiData = false) => {
    if (!hasApiData) return "PENDING";
    if (trustScore < MANUAL_REVIEW_THRESHOLD || riskFlags.includes("high_dispute")) {
        return "FLAGGED";
    }
    if (trustScore >= 70 && !riskFlags.includes("new_supplier")) {
        return "VERIFIED";
    }
    return "PENDING";
};

const deriveDisplayBadge = (verificationStatus, trustScore) => {
    if (verificationStatus === "VERIFIED") return "Verified Supplier";
    if (verificationStatus === "FLAGGED") return "Review Required";
    if (trustScore >= 55) return "Established Seller";
    return "New Seller";
};

const buildVerificationRecord = ({
    memberId,
    sellerOpenId = "",
    seller_id = "",
    supplier_id = "",
    member = {},
    company = {},
    productDetails = {},
}) => {
    const fields = normalizeSupplierApiPayload({ member, company, productDetails });
    const resolvedMemberId = firstString(memberId, fields.member_id, sellerOpenId, supplier_id);

    const trust_score = computeTrustScore(fields);
    const risk_flags = deriveRiskFlags(fields, trust_score);
    const recommended_for = deriveRecommendedFor(fields, trust_score, risk_flags);
    const verification_status = deriveVerificationStatus(
        trust_score,
        risk_flags,
        fields._hasApiData
    );
    const display_badge = deriveDisplayBadge(verification_status, trust_score);
    const manual_review_required =
        trust_score < MANUAL_REVIEW_THRESHOLD || verification_status === "FLAGGED";

    const now = new Date();
    const next_refresh_at = new Date(now.getTime() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    return {
        member_id: resolvedMemberId,
        sellerOpenId: firstString(sellerOpenId, fields.member_id),
        seller_id: firstString(seller_id),
        supplier_id: firstString(supplier_id, resolvedMemberId),
        company_name: fields.company_name,
        business_license_no: fields.business_license_no,
        registered_capital: fields.registered_capital,
        years_on_platform: fields.years_on_platform,
        credit_level: fields.credit_level,
        transaction_count_90d: fields.transaction_count_90d,
        dispute_rate: fields.dispute_rate,
        on_time_delivery_rate: fields.on_time_delivery_rate,
        product_categories: fields.product_categories,
        trust_score,
        verification_status,
        risk_flags,
        recommended_for,
        display_badge,
        manual_review_required,
        integration_type: "api",
        last_verified_at: now,
        next_refresh_at,
        raw_member: member && Object.keys(member).length ? member : null,
        raw_company: company && Object.keys(company).length ? company : null,
        last_error: "",
    };
};

const needsRefresh = (record) => {
    if (!record) return true;
    if (!record.last_verified_at) return true;
    const next = record.next_refresh_at ? new Date(record.next_refresh_at) : null;
    if (next && !Number.isNaN(next.getTime()) && next.getTime() > Date.now()) {
        return false;
    }
    const last = new Date(record.last_verified_at);
    if (Number.isNaN(last.getTime())) return true;
    const ageMs = Date.now() - last.getTime();
    return ageMs >= REFRESH_DAYS * 24 * 60 * 60 * 1000;
};

const toPublicVerification = (record) => {
    if (!record) return null;
    const plain = typeof record.toObject === "function" ? record.toObject() : { ...record };
    delete plain.raw_member;
    delete plain.raw_company;
    delete plain.last_error;
    delete plain.__v;
    return plain;
};

module.exports = {
    REFRESH_DAYS,
    MANUAL_REVIEW_THRESHOLD,
    normalizeSupplierApiPayload,
    buildVerificationRecord,
    needsRefresh,
    toPublicVerification,
    computeTrustScore,
};
