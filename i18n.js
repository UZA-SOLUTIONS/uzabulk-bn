const i18n = require('i18n');

i18n.configure({
    locales: ['en', 'fr'],
    directory: __dirname + '/locales',
    defaultLocale: 'en',
    cookie: 'lang',
    register: global,
    objectNotation: true,
});

const parseCookieHeader = (req) => {
    const header = String(req?.headers?.cookie || '');
    if (!header) return {};
    return header.split(';').reduce((acc, part) => {
        const [rawKey, ...rest] = part.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rest.join('=') || '');
        return acc;
    }, {});
};

const resolveLocale = (req) => {
    const cookies = parseCookieHeader(req);
    if (cookies.lang === 'fr' || cookies.lang === 'en') {
        return cookies.lang;
    }

    const header = String(req?.headers?.['accept-language'] || '').toLowerCase();
    if (header.startsWith('fr') || header.includes('fr-')) {
        return 'fr';
    }

    return 'en';
};

module.exports = function (req, res, next) {
    i18n.init(req, res);
    const locale = resolveLocale(req);
    req.setLocale(locale);
    res.setLocale(locale);
    if (typeof res.cookie === 'function') {
        res.cookie('lang', locale, {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            sameSite: 'Lax',
        });
    }
    return next();
};
