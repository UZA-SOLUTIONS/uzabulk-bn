const buildOfferIdCandidates = (raw) => {
    const s = String(raw || "").trim();
    if (!s || s.length > 32 || !/^\d+$/.test(s)) return [];
    const candidates = [s];
    const noLeadingZeros = s.replace(/^0+(?=\d)/, "");
    if (noLeadingZeros && noLeadingZeros !== s) {
        candidates.push(noLeadingZeros);
    }
    return [...new Set(candidates)];
};

const looksLikeObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const findActiveProductById = async (mongoId) => {
    if (!looksLikeObjectId(mongoId)) return null;
    return _model.Product.findOne({ _id: mongoId, status: "active" })
        .select("_id offerId last_updated")
        .lean();
};

const findActiveProductByOffer = async (rawOffer) => {
    const candidates = buildOfferIdCandidates(rawOffer);
    if (!candidates.length) return null;
    return _model.Product.findOne({
        status: "active",
        offerId: { $in: candidates },
    })
        .select("_id offerId last_updated")
        .lean();
};

const productValidate = async (req, res, next) => {
    try {
        const paramId = String(req.params._id || "").trim();
        const offerFromQuery = String(req.query.offerId || req.query.topIds || "").trim();

        let product = await findActiveProductById(paramId);

        if (!product && offerFromQuery) {
            product = await findActiveProductByOffer(offerFromQuery);
        }

        if (!product && buildOfferIdCandidates(paramId).length) {
            product = await findActiveProductByOffer(paramId);
        }

        if (!product) return res.error("INVALID_PRODUCT_ID");

        req.product = product;
        req.params._id = String(product._id);

        return next();
    } catch (error) {
        res.error(error);
    }
};

module.exports = { productValidate };
