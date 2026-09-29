const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campus-expenses/bank-slips',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  },
});

// Limit each upload to 5 MB and only allow the file types the app actually uses.
// (Cloudinary's allowed_formats above already blocks other types, but checking
// here too rejects bad files before they are sent to Cloudinary.)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG or PDF files are allowed'));
  },
});

module.exports = upload;