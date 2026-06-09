const mongoose = require('mongoose');
const models = require('../../models');

const mongoAtlasUri = env.mongoAtlasUri;

module.exports = function initConnection(callback) {
    mongoose.connect(mongoAtlasUri);
    var db = mongoose.connection;
    db.on('error', function (err) {
        console.log('Failed to connect to database');
        console.log(err);
        process.exit(1);
    });

    db.on('connecting', function () {
        console.log('connecting to Mongo DB...');
    });
    db.on('error', function (error) {
        console.error('error in mongo db connection: ' + error);
    });
    db.on('connected', function () {
        console.log('Mongo db connected!');
    });
    db.once('open', function () {
        console.log(' db connection opened.');
        models.setup(db).then(res => {
            console.log('Models Set Successfully.')
            callback(db);
        });
    });
    db.on('reconnected', function () {
        console.log('Mongo db reconnected!');
    });
    db.on('disconnected', function () {
        console.error('Mongo db disconnected!');
    });
};