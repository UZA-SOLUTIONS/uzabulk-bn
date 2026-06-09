var multer = require('multer');
var multerS3 = require('multer-s3');
const { S3Client } = require("@aws-sdk/client-s3");
const path = require('path');
const fs = require('fs');

const s3 = new S3Client({
  credentials: {
    accessKeyId: env.AWS.SECRET_ACCESS_ID,
    secretAccessKey: env.AWS.SECRET_ACCESS_KEY
  },
  region: env.AWS.REGION_NAME
});


module.exports.uploadS3File = (req, res, next) => {
  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: env.AWS.BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      acl: 'public-read',
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        cb(null, Date.now().toString() + '-' + file.originalname);
      },
    }),
    limits: { fileSize: 500000000 },
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      console.log('Upload error:', err);
      return res.error(err);
    }
    next();
  });
};

const imagesDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

module.exports.uploadLocalFile = (req, res, next) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, imagesDir); // Save files to public/images
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s/g, '_');
        cb(null, uniqueSuffix);
      },
    }),
    limits: { fileSize: 500000000 }, // Limit file size to 500MB
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.error(err);
    }
    const host = req.get("host");
    const protocol = req.protocol || "http";
    const localUrl = host
        ? `${protocol}://${host}/images/${req.file.filename}`
        : `${env.BASE_URL}/images/${req.file.filename}`;
    req.file.location = localUrl;
    console.log(req.file)
    next();
  });
};