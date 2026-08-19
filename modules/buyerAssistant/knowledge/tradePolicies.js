/**
 * Grounding chunks for trade policies, shipping rules, and buyer FAQs.
 * AnalyticDB-ready: each row maps to a `trade_policies` / `shipping_rules` document.
 */
module.exports = [
    {
        id: "policy_moq",
        source: "trade_policies",
        title: "Minimum order quantity (MOQ)",
        text: "Wholesale listings show MOQ per product or variation. Cart quantity must meet or exceed MOQ before checkout. Mixed-SKU MOQ rules follow the supplier listing stored in the catalog.",
        tags: ["moq", "minimum", "order", "quantity", "wholesale"],
    },
    {
        id: "policy_pricing",
        source: "trade_policies",
        title: "Pricing and currency",
        text: "Displayed prices come from the live UZA catalog and may reflect currency conversion. Final checkout totals include tax, delivery fee, and any coupon discounts applied at checkout.",
        tags: ["price", "pricing", "cost", "currency", "tax"],
    },
    {
        id: "policy_payment",
        source: "trade_policies",
        title: "Payment and order confirmation",
        text: "Orders are placed on UZA Bulk. Payment methods available at checkout must be completed to confirm the order. Bank slip upload may be required for certain payment flows before fulfillment.",
        tags: ["payment", "pay", "checkout", "slip", "cod"],
    },
    {
        id: "shipping_1688_consolidation",
        source: "shipping_rules",
        title: "Supplier consolidation shipping",
        text: "Supplier shipments typically route to the UZA consolidation warehouse in China first, then forward internationally. Transit time depends on supplier dispatch, customs, and last-mile delivery to your address.",
        tags: ["shipping", "consolidation", "warehouse", "china"],
    },
    {
        id: "shipping_eta",
        source: "shipping_rules",
        title: "Delivery timelines",
        text: "Domestic China leg: 2–5 business days after supplier ships. International leg: typically 10–25 business days depending on route and customs. Express options vary by supplier and product category.",
        tags: ["delivery", "eta", "timeline", "how long", "arrive"],
    },
    {
        id: "shipping_tracking",
        source: "logistics_data",
        title: "Tracking your shipment",
        text: "When a supplier order is relayed, tracking events sync into your UZA order. Use your order ID in chat or My Orders to see status, carrier name, and waybill number when available.",
        tags: ["track", "tracking", "logistics", "carrier", "waybill"],
    },
    {
        id: "policy_returns",
        source: "trade_policies",
        title: "Returns and disputes",
        text: "Report damaged, wrong, or missing items promptly with photos and your order ID. High-risk disputes are escalated to a human agent. Refund eligibility follows supplier and UZA buyer protection policies.",
        tags: ["return", "refund", "dispute", "damaged", "wrong item"],
    },
    {
        id: "policy_guest_cart",
        source: "trade_policies",
        title: "Guest cart and sign-in",
        text: "Guests can browse and add items to a temporary cart tied to their device. Sign in to save the cart across devices, view order history, and checkout with saved addresses.",
        tags: ["guest", "sign in", "login", "account", "cart", "checkout"],
    },
    {
        id: "policy_sourcing",
        source: "trade_policies",
        title: "Sourcing from suppliers",
        text: "UZA Bulk sources from verified suppliers. Product specs, availability, and lead times come from catalog sync. Supplier-side spec changes may update listing attributes after sync.",
        tags: ["sourcing", "supplier", "availability", "specs"],
    },
];
