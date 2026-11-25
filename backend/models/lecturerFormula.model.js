const mongoose = require('mongoose');

// A salary formula typed in by the super admin, e.g.  attendance * subFee * percentage%
// Batches and lecturers can be set to use one; every salary entry keeps a COPY of the
// formula it was calculated with, so editing a formula later never changes old entries.
const lecturerFormulaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // 'expression' = a maths formula (attendance * subFee * percentage% ...)
    // 'range'      = attendance ranges, each with its own amount (e.g. 1-10 = Rs. 500, 11-50 = Rs. 400)
    kind: { type: String, enum: ['expression', 'range'], default: 'expression' },
    // For a range formula this is a readable summary of the ranges.
    expression: { type: String, required: true, trim: true },
    // Each range: from .. to (to empty = "and above"). perUnit false = the amount IS the salary,
    // perUnit true = amount x the attendance (or x the hours).
    tiers: [new mongoose.Schema({ from: Number, to: { type: Number, default: null }, amount: Number, perUnit: { type: Boolean, default: false }, payBy: { type: String, enum: ['total', 'unit', 'rate'] }, percentage: Number }, { _id: false })],
    // payBy: 'total' = the amount is the salary | 'unit' = amount x attendance (or hours) | 'rate' = attendance (or hours) x (amount as the sub fee x percentage%).
    // What the ranges are counted on.
    rangeBy: { type: String, enum: ['attendance', 'hours'], default: 'attendance' },
    // Older range formulas had one setting for all ranges; kept so they still work.
    rangeBasis: { type: String, enum: ['fixed', 'perAttendance'], default: 'fixed' },
    // Optional: only offered to batches of this degree (e.g. Art). Empty = every degree.
    degree: { type: String, trim: true },
    description: { type: String, trim: true },
    // The built-in "Standard" formula, used when a batch / lecturer has none chosen. It cannot be deleted.
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LecturerFormula', lecturerFormulaSchema);