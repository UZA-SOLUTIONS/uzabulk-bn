const fs = require('fs');
const { includes } = require('lodash');
const elasticsearch = require('../elasticsearch');
exports.setup = function () {
    global._model = {};
    fs.readdir(__dirname, function (err, files) {
        for (var i in files) {
            if (files[i] == 'index.js')
                continue;
            if (files[i].split('.').length > 2)
                continue;
            if (skipFiles(files[i].split('.')[0]))
                continue;
            try {
                var t = require('./' + files[i]);
                global._model[t.modelName] = t;
            } catch (e) {
                console.log(e)
            }
        }
        _model.CurrencyExchangeRate?.createDefault();

        elasticsearch();
    });
};

function skipFiles(fileName) {
    const referenceUserFile = [
    ];
    return includes(referenceUserFile, fileName)
}