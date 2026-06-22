const crypto = require("crypto");

const AB_TEST_ENABLED = () => {
    const flag = String(process.env.RECOMMENDATION_AB_TEST ?? "true").toLowerCase();
    return flag !== "0" && flag !== "false";
};

const TREATMENT_RATIO = () => {
    const ratio = Number(process.env.RECOMMENDATION_AB_TREATMENT_RATIO || 0.5);
    if (!Number.isFinite(ratio)) return 0.5;
    return Math.min(Math.max(ratio, 0), 1);
};

/**
 * Stable A/B group assignment per identity key.
 */
const assignAbGroup = (identityKey = "") => {
    if (!AB_TEST_ENABLED()) return "control";

    const hash = crypto
        .createHash("sha256")
        .update(String(identityKey || "guest"))
        .digest();

    const bucket = hash.readUInt32BE(0) / 0xffffffff;
    return bucket < TREATMENT_RATIO() ? "treatment" : "control";
};

module.exports = {
    assignAbGroup,
    AB_TEST_ENABLED,
};
