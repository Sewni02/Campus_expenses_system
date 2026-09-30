const cloudinary = require('../config/cloudinary');

// Files are uploaded to Cloudinary by the upload middleware BEFORE the
// controller/service checks the rest of the form. If that check then fails
// (bad amount, missing field, record not found...), the file is already sitting
// in Cloudinary but no database record points at it - an "orphan" that costs
// storage forever, and every retry by the user adds another one.
// The central error handler calls this to delete them.

const collectUploadedFiles = (req) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((group) => files.push(...group));
  }
  return files;
};

// Best effort: never throws, so a Cloudinary hiccup can't turn a clean
// "400 amount must be greater than 0" into a 500.
// (multer-storage-cloudinary stores the Cloudinary public_id in file.filename.)
const removeUploadedFiles = async (req) => {
  const publicIds = collectUploadedFiles(req)
    .map((file) => file.filename)
    .filter(Boolean);

  await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
  );
};

module.exports = { removeUploadedFiles, collectUploadedFiles };