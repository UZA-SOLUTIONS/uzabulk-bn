const moduleConfig = require('../config/moduleConfig');
module.exports = function (app) {

    moduleConfig.forEach(element => {
        if (element.status && element.route) {
            let path = require('../modules/' + element.type);
            app.use('/api/' + element.apiVersion + '/' + element.routeName, path);
        }
    });

};