const i18n = require('i18n');

i18n.configure({
    // setup some locales - other locales default to en silently
    locales: ['en', 'fr'],

    // where to store json files - defaults to './locales' relative to modules directory
    directory: __dirname + '/locales',

    //directoryPermissions: '755',

    defaultLocale: 'en',

    // sets a custom cookie name to parse locale settings from  - defaults to NULL
    cookie: 'lang',

    // autoReload: true,

    register: global
});

module.exports = function (req, res, next) {

    i18n.init(req, res);

    setLocale('en');

    return next();
};