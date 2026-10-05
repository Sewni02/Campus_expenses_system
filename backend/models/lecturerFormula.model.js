const mongoose = require('mongoose');

// A salary formula typed in by the super admin, e.g.  attendance * subFee * percentage%
// Batches and lecturers can be set to use one; every salary entry keeps a COPY of the
// formula it was calculated with, so editing a formula later never changes old entries.
const lecturerFormulaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    expression: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // The built-in "Standard" formula, used when a batch / lecturer has none chosen. It cannot be deleted.
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LecturerFormula', lecturerFormulaSchema);