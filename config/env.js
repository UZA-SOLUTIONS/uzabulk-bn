const env = {
    "jwtSecret": "customerUZA##123",
    "terminologyLang": ["en", "fr", "es", "de", "it", "ru", "ht", "zh"],
    "mongoAtlasUri": process.env.MONGO_ATLAS_URI || process.env.MONGO_URI || "",
    "socketUrl": "",
    "socketIp": "",
    "socketUrlApi": "",
    "apiUrl": "https://uza-customer-api.suffescom.dev/authenticationservice/api/v1/",
    "apiBaseUrl": "https://uza-customer-api.suffescom.dev",
    BASE_URL: "https://uza-customer-api.suffescom.dev",
    CLIENT_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000",
    googleAuth: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
        REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
    },
    ELASTIC_SEARCH: {
        BASE_URL: process.env.ES_SERVICE_URL || process.env.ELASTIC_SEARCH_BASE_URL || "",
        IS_SECURITY_ENABLED: String(process.env.ELASTIC_SEARCH_IS_SECURITY_ENABLED || "").toLowerCase() === "true",
        USERNAME: process.env.ELASTIC_SEARCH_USERNAME || "elastic",
        PASSWORD: process.env.ELASTIC_SEARCH_PASSWORD || "",
    },
    "AWS": {
        "SECRET_ACCESS_KEY": process.env.S3_SECRET_ACCESS_KEY,
        "SECRET_ACCESS_ID": process.env.S3_ACCESS_KEY,
        "REGION_NAME": process.env.S3_REGION,
        "BUCKET_NAME": process.env.S3_BUCKET_NAME,
    },
    "AWS_SES": {
        "EMAIL_SOURCE": process.env.SES_EMAIL_SOURCE,
        "ACCESS_ID": process.env.SES_ACCESS_KEY,
        "SECRET_KEY": process.env.SES_SECRET_ACCESS_KEY,
        "REGION_NAME": process.env.SES_REGION,
    },
    "SMTP": {
        // Match admin-bn: prefer SMTP_* keys, fall back to legacy HOST/USERNAME/PASSWORD.
        "EMAIL_SOURCE": process.env.EMAIL_SOURCE || process.env.SMTP_USER,
        "HOST": process.env.SMTP_HOST || process.env.HOST,
        "PORT": Number(process.env.SMTP_PORT || process.env.SMTP_MAIL_PORT || 587),
        "SECURE": String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
        "USERNAME": process.env.SMTP_USER || process.env.USERNAME,
        "PASSWORD": process.env.SMTP_PASS || process.env.PASSWORD,
    },
    "twilio": {
        "accountSid": "",
        "authToken": "",
        "twilioFrom": ""
    },
    "mailgun": {
        "MAILGUN_API_KEY": "",
        "MAILGUN_DOMAIN": "",
        "MAILGUN_FROM": ""
    },
    "firebase": {
        "FCM_APIKEY": process.env.FCM_APIKEY || process.env.REACT_APP_APIKEY || "",
        "FCM_AUTHDOMAIN": process.env.FCM_AUTHDOMAIN || process.env.REACT_APP_AUTHDOMAIN || "",
        "FCM_DATABASEURL": process.env.FCM_DATABASEURL || process.env.REACT_APP_DATABASEURL || "",
        "FCM_PROJECTID": process.env.FCM_PROJECTID || process.env.REACT_APP_PROJECTID || "",
        "FCM_STORAGEBUCKET": process.env.FCM_STORAGEBUCKET || process.env.REACT_APP_STORAGEBUCKET || "",
        "FCM_MESSAGINGSENDERID": process.env.FCM_MESSAGINGSENDERID || process.env.REACT_APP_MESSAGINGSENDERID || "",
        "FCM_APPID": process.env.FCM_APPID || process.env.REACT_APP_APPID || "",
        "FCM_MEASUREMENTID": process.env.FCM_MEASUREMENTID || process.env.REACT_APP_MEASUREMENTID || "",
        "FCM_CLIENT_EMAIL": process.env.FCM_CLIENT_EMAIL || "",
        "FCM_PRIVATE_KEY": process.env.FCM_PRIVATE_KEY || ""
    },
    /**
     * 1688 Open Platform (gw.open.1688.com) — not the same as a generic Alibaba Cloud app listing.
     * If you see gw.APIACLDecline / "AppKey is not allowed(acl)", the AppKey in ALIBABA_APP_KEY must belong
     * to a 1688 app that has subscribed to the APIs you call (e.g. fenxiao.crossborder product.search.*).
     * Set these from https://open.1688.com → Application Center → your app (App Key, App Secret) and a valid access_token.
     */
    "alibaba": {
        "BASE_APP_URL": process.env.ALIBABA_BASE_APP_URL || "http://gw.open.1688.com/openapi/",
        "APP_KEY": process.env.ALIBABA_APP_KEY || "",
        "APP_SECRET": process.env.ALIBABA_APP_SECRET || "",
        "AUTH_TOKEN": process.env.ALIBABA_AUTH_TOKEN || "",
        "TO_PROVINCE_CODE": "330000",
        "TO_CITY_CODE": "330100",
        "TO_COUNTRY_CODE": "330108",
        "TRADE_ENABLED": String(process.env.ALIBABA_TRADE_ENABLED || "true").toLowerCase() !== "false",
        "TRADE_FLOW": process.env.ALIBABA_TRADE_FLOW || "general",
        "OAUTH_ENABLED": String(process.env.ALIBABA_OAUTH_ENABLED || "").toLowerCase() === "true",
        "OAUTH_REDIRECT_URI": process.env.ALIBABA_OAUTH_REDIRECT_URI || "",
    },
    "google": {
        "VISION_API_KEY": process.env.GOOGLE_VISION_API_KEY || "",
        "CLIENT_EMAIL": process.env.GOOGLE_CLIENT_EMAIL || "",
        "PRIVATE_KEY": process.env.GOOGLE_PRIVATE_KEY || "",
        "TOKEN_URI": process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token"
    },
    "localImageSearch": {
        "ENABLED": String(process.env.LOCAL_IMAGE_SEARCH_ENABLED ?? "true").toLowerCase() !== "false",
        "PYTHON_BIN": process.env.LOCAL_IMAGE_SEARCH_PYTHON_BIN || "python",
        "SCRIPT": process.env.LOCAL_IMAGE_SEARCH_SCRIPT || "",
        "INDEX_PATH": process.env.LOCAL_IMAGE_SEARCH_INDEX || "",
        "META_PATH": process.env.LOCAL_IMAGE_SEARCH_META || ""
    },
    "dashscope": {
        "API_KEY": process.env.DASHSCOPE_API_KEY || "",
        "WORKSPACE_ID": process.env.DASHSCOPE_WORKSPACE_ID || "",
        "REGION": process.env.DASHSCOPE_REGION || "singapore",
        "BASE_URL": process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "MODEL": process.env.DASHSCOPE_MODEL || "qwen-vl-plus",
        "VL_MODEL": process.env.DASHSCOPE_VL_MODEL || "qwen-vl-plus",
        "EMBEDDING_MODEL": process.env.DASHSCOPE_EMBEDDING_MODEL || "text-embedding-v3",
        "EMBEDDING_DIMENSIONS": Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS || 1024),
        "TIMEOUT_MS": Number(process.env.DASHSCOPE_TIMEOUT_MS || 60000),
        "AUTO_SMART_LISTING": process.env.DASHSCOPE_AUTO_SMART_LISTING ?? "true",
        "AUTO_RECOMMENDATIONS": process.env.DASHSCOPE_AUTO_RECOMMENDATIONS ?? "true",
        "RECOMMENDATION_BOOST_WEIGHT": Number(process.env.DASHSCOPE_RECOMMENDATION_BOOST_WEIGHT || 4),
        "AI_SEARCH": process.env.DASHSCOPE_AI_SEARCH ?? "true",
        "AI_TEXT_SEARCH": process.env.DASHSCOPE_AI_TEXT_SEARCH ?? "true",
        "AI_IMAGE_SEARCH": process.env.DASHSCOPE_AI_IMAGE_SEARCH ?? "true",
    },
    DEFAULT_SKIP: 1,
    MAX_LIMIT: 10,
    DEFAULT_SORT_DIRECTION: -1,
    PORT: Number(process.env.PORT || 1302),
    ROLE: "USER",
    RETAILER_ROLE: "RETAILER",
    taxSettings: {
        level: "store",
        percentage: 2
    },
    storeId: "660e3c271095513081ed2211",
    storeTypeId: "660e3c271095513081ed2223",
}

module.exports = env;
