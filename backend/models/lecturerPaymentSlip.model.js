const mongoose = require('mongoose');

// ONE bank slip for a whole degree and month: e.g. the slip of the transfer that paid all the Art lecturers
// for October 2026. Uploading again replaces it. The file itself lives in Cloudinary (see middleware/upload.js).
const lecturerPaymentSlipSchema = new mongoose.Schema(
  {
    faculty: { type: String, required: true, trim: true }, // the degree name (Art, Management ...)
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // 2026-10
    slipUrl: { type: String, required: true },
    slipFileName: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String },
  },
  { timestamps: true }
);

lecturerPaymentSlipSchema.index({ faculty: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('LecturerPaymentSlip', lecturerPaymentSlipSchema);