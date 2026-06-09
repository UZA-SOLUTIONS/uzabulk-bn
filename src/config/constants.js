export const APP_NAME = "UZA Store";

/** Brand mark from `public/newlogo.png` */
export const BRAND_LOGO_PNG = `${process.env.PUBLIC_URL || ""}/newlogo.png`;

export const CURRENCY_SYMBOL = "RWF ";

export const CURRENCY_NAME = "";

export const defaultExchangeRate = { name: "United State Dollar", code: "USD", symbol: "$", imageUrl: "https://uza-ecomm.s3.us-east-2.amazonaws.com/1726035363694united-states.png", };

/** Support contact for product chat (WhatsApp: country code + number, no + or spaces). */
export const SUPPORT_WHATSAPP = process.env.REACT_APP_SUPPORT_WHATSAPP || "0788371081";
export const SUPPORT_EMAIL =
  process.env.REACT_APP_SUPPORT_EMAIL || "uzasolutionsltd@gmail.com";