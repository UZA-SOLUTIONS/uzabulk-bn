var multer = require('multer');
var multerS3 = require('multer-s3');
const { S3Client } = require("@aws-sdk/client-s3");

const config = require('../config/config');

const s3 = new S3Client({
  credentials: {
    accessKeyId: config.AWS.SECRET_ACCESS_ID,
    secretAccessKey: config.AWS.SECRET_ACCESS_KEY
  },
  region: config.AWS.REGION_NAME
})

var upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: config.AWS.BUCKET_NAME,
    contentLength: 500000000,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + file.originalname)
    }
  })
});

module.exports = upload;