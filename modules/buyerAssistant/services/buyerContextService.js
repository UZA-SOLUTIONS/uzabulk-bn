const User = require("../../../models/userTable");
const Order = require("../../../models/ordersTable");
const Cart = require("../../../models/cartTable");
const Address = require("../../../models/addressTable");

const displayName = (user = {}) =>
    user.name
    || user.hintName
    || [user.firstName, user.lastName].filter(Boolean).join(" ")
    || "Customer";

const buildBuyerProfileChunk = async (userId) => {
    if (!userId) return null;

    const user = await User.findById(userId)
        .select("name hintName firstName lastName email mobileNumber countryCode altMobileNumber altCountryCode country city loyaltyPoints status role date_created_utc")
        .lean();
    if (!user) return null;

    const name = displayName(user);
    const lines = [
        `Customer name: ${name}`,
        user.email ? `Email: ${user.email}` : "",
        user.mobileNumber
            ? `Phone: ${[user.countryCode, user.mobileNumber].filter(Boolean).join(" ")}`
            : "",
        user.altMobileNumber
            ? `Alt phone: ${[user.altCountryCode, user.altMobileNumber].filter(Boolean).join(" ")}`
            : "",
        user.country ? `Country: ${user.country}` : "",
        user.city ? `City: ${user.city}` : "",
        user.loyaltyPoints?.points != null ? `Loyalty points: ${user.loyaltyPoints.points}` : "",
        user.status ? `Account status: ${user.status}` : "",
        user.date_created_utc ? `Member since: ${user.date_created_utc}` : "",
    ].filter(Boolean);

    return {
        source: "customer_profile",
        title: `Signed-in buyer: ${name}`,
        text: lines.join("\n"),
        score: 2.5,
    };
};

const buildRecentOrdersChunk = async (userId, limit = 4) => {
    if (!userId) return null;

    const orders = await Order.find({ user: userId })
        .sort({ date_created_utc: -1 })
        .limit(limit)
        .select("customOrderId orderStatus paymentStatus orderTotal totalItems date_created_utc alibaba1688.status alibaba1688.primary_order_id")
        .lean();

    if (!orders.length) {
        return {
            source: "order_history",
            title: "Your order history",
            text: "This buyer has no orders on record yet.",
            score: 1.4,
        };
    }

    const text = orders.map((order) => {
        const parts = [
            `Order ${order.customOrderId || order._id}`,
            `Status: ${order.orderStatus}`,
            `Payment: ${order.paymentStatus}`,
            `Total: ${order.orderTotal}`,
            `Items: ${order.totalItems || 0}`,
        ];
        if (order.alibaba1688?.status) parts.push(`1688 status: ${order.alibaba1688.status}`);
        if (order.alibaba1688?.primary_order_id) {
            parts.push(`1688 ID: ${order.alibaba1688.primary_order_id}`);
        }
        if (order.date_created_utc) parts.push(`Placed: ${order.date_created_utc}`);
        return parts.join(" | ");
    }).join("\n");

    return {
        source: "order_history",
        title: "Your recent orders",
        text,
        score: 1.9,
    };
};

const buildCartChunk = async ({ userId, deviceId }) => {
    const query = { status: "process", cartType: "default" };
    if (userId) query.user = userId;
    else if (deviceId) query.deviceId = deviceId;
    else return null;

    const cart = await Cart.findOne(query).sort({ date_modified_utc: -1 }).lean();
    if (!cart?.items?.length) return null;

    const lines = [
        `Cart subtotal: ${cart.subTotal || 0}`,
        ...cart.items.slice(0, 10).map((item) => {
            const label = item.productName || "Product";
            return `${item.quantity}x ${label} — unit ${item.unitPrice}, line ${item.amount}`;
        }),
    ];

    return {
        source: "customer_cart",
        title: "Current shopping cart",
        text: lines.join("\n"),
        score: 1.6,
    };
};

const buildAddressesChunk = async (userId) => {
    if (!userId) return null;

    const addresses = await Address.find({ user: userId, status: "active" })
        .sort({ default: -1, date_created_utc: -1 })
        .limit(4)
        .lean();

    if (!addresses.length) return null;

    const text = addresses.map((addr) => {
        const parts = [
            `${addr.addressType || "address"}${addr.default ? " (default)" : ""}`,
            addr.name,
            [addr.houseNo, addr.address, addr.landmark, addr.area].filter(Boolean).join(", "),
        ];
        if (addr.mobileNumber) {
            parts.push(`Phone: ${[addr.countryCode, addr.mobileNumber].filter(Boolean).join("")}`);
        }
        return parts.filter(Boolean).join(" — ");
    }).join("\n");

    return {
        source: "customer_addresses",
        title: "Saved delivery addresses",
        text,
        score: 1.3,
    };
};

const buildBuyerContextChunks = async ({ userId, deviceId } = {}) => {
    if (!userId) return [];

    const [profile, orders, cart, addresses] = await Promise.all([
        buildBuyerProfileChunk(userId),
        buildRecentOrdersChunk(userId),
        buildCartChunk({ userId, deviceId }),
        buildAddressesChunk(userId),
    ]);

    return [profile, orders, cart, addresses].filter(Boolean);
};

module.exports = {
    buildBuyerProfileChunk,
    buildRecentOrdersChunk,
    buildCartChunk,
    buildAddressesChunk,
    buildBuyerContextChunks,
    displayName,
};
