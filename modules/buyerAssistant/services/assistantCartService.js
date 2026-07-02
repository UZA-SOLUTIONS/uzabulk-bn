const Cart = require("../../carts/services");
const validation = require("../../carts/input-validation");
const Address = require("../../../models/addressTable");
const CartModel = require("../../../models/cartTable");
const { buildProductCard } = require("./assistantEnrichmentService");

const getCartSnapshot = async ({ userId, deviceId } = {}) => {
    const query = { status: "process", cartType: userId ? "default" : "temp" };
    if (userId) query.user = userId;
    else if (deviceId) query.deviceId = deviceId;
    else return { itemCount: 0, lineCount: 0, subTotal: 0, items: [], carts: [] };

    const carts = await CartModel.find(query).sort({ date_modified_utc: -1 }).lean();
    const items = [];
    let subTotal = 0;

    carts.forEach((cart) => {
        (cart.items || []).forEach((line) => {
            items.push({
                productId: String(line.product || cart.product || ""),
                productName: line.productName || "Product",
                quantity: line.quantity || 0,
                unitPrice: line.unitPrice || line.price || 0,
                amount: line.amount || 0,
                cartId: String(cart._id),
            });
        });
        subTotal += Number(cart.subTotal || 0);
    });

    const itemCount = items.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

    return {
        itemCount,
        lineCount: items.length,
        subTotal,
        items: items.slice(0, 12),
        carts,
    };
};

const addProductToBuyerCart = async ({
    productId,
    quantity = 1,
    userId,
    deviceId,
    isLogin,
} = {}) => {
    const getProduct = await Cart.getProduct({ _id: productId, status: "active" });
    if (!getProduct) {
        throw new Error("PRODUCT_IS_INVALID");
    }

    const qty = Math.max(1, Math.min(Number(quantity) || 1, 999999));
    const lineData = await validation.generateLineItems(getProduct, [{ quantity: qty }]);

    const data = {
        items: lineData.items,
        product: getProduct._id,
        subTotal: lineData.itemTotal,
        deviceId: deviceId || "",
        status: "process",
    };

    if (isLogin && userId) {
        data.user = userId;
        data.cartType = "default";
    } else {
        data.cartType = "temp";
    }

    let existingCartQuery = {};
    if (isLogin && userId) {
        existingCartQuery = { product: data.product, user: data.user, cartType: "default" };
    } else {
        existingCartQuery = { product: data.product, deviceId: data.deviceId, cartType: "temp" };
    }

    const getExistanceCart = await Cart.getExistanceCart(existingCartQuery);
    let result;
    if (getExistanceCart) {
        const updatedItems = validation.addInExistanceCart(getProduct, getExistanceCart.items, data.items);
        result = await Cart.updateCart({ _id: getExistanceCart._id }, updatedItems);
    } else {
        result = await Cart.addToCart(data);
    }

    return {
        product: getProduct,
        quantity: qty,
        cart: result,
        card: buildProductCard(getProduct),
    };
};

const hasSavedAddress = async (userId) => {
    if (!userId) return false;
    const count = await Address.countDocuments({ user: userId, status: "active" });
    return count > 0;
};

const buildGroundedCartAnswer = (cartSnapshot = {}, language = "en", isLoggedIn = false) => {
    const count = Number(cartSnapshot.itemCount || 0);
    const subTotal = cartSnapshot.subTotal ?? 0;
    const items = cartSnapshot.items || [];

    const copy = {
        en: {
            empty: "Your cart is empty. Tell me what you're looking for (e.g. <strong>black t-shirts</strong>) and I'll search the catalog — or browse products below.",
            guest: "Sign in to save your cart across devices. You can still browse and tell me what products to find.",
            intro: (n) => `Your cart has <strong>${n}</strong> item(s), subtotal <strong>${subTotal}</strong>:`,
            outro: "Use <strong>View cart</strong> below to edit quantities or proceed to checkout.",
        },
        fr: {
            guest: "Connectez-vous pour voir votre panier enregistré.",
            empty: "Votre panier est vide pour le moment.",
            intro: (n) => `Votre panier contient <strong>${n}</strong> article(s), sous-total <strong>${subTotal}</strong> :`,
            outro: "Utilisez <strong>View cart</strong> pour modifier ou passer commande.",
        },
    };
    const t = copy[language] || copy.en;

    if (count === 0) {
        return isLoggedIn ? t.empty : `${t.empty}<br/>${t.guest}`;
    }

    const lines = items.slice(0, 8).map((row) => {
        const qty = row.quantity || 0;
        const name = row.productName || "Product";
        const unit = row.unitPrice != null ? row.unitPrice : "";
        const lineTotal = row.amount != null ? row.amount : "";
        const pricePart = unit !== "" ? ` — <strong>${unit}</strong> each` : "";
        const totalPart = lineTotal !== "" ? ` (<strong>${lineTotal}</strong> line total)` : "";
        return `• <strong>${qty}× ${name}</strong>${pricePart}${totalPart}`;
    }).join("<br/>");

    return `${t.intro(count)}<br/>${lines}<br/>${t.outro}`;
};

module.exports = {
    getCartSnapshot,
    addProductToBuyerCart,
    hasSavedAddress,
    buildGroundedCartAnswer,
};
