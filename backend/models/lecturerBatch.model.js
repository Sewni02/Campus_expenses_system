const mongoose = require('mongoose');

// One lecturer inside one batch. The same person teaching in two batches is
// simply added in both (each batch can have its own rates).
const lecturerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    // Language the lecturer teaches in.
    medium: { type: String, enum: ['english', 'sinhala', 'both'] },
    // How this lecturer is normally paid:
    //   formula = attendance x sub fee x percentage / 100   (needs subFee + percentage)
    //   fixed   = a fixed amount, outside the formula       (needs fixedSalary)
    payType: { type: String, enum: ['formula', 'fixed'], default: 'formula' },
    subFee: { type: Number, min: 0.01 },
    percentage: { type: Number, min: 0.01, max: 100 },
    fixedSalary: { type: Number, min: 0.01 },
    // Pay per hour (for formulas that use hours x hourRate). Each batch / lecturer has its own rate.
    hourRate: { type: Number, min: 0.01 },
    // Formula for this lecturer (optional). Empty = use the batch's formula.
    formula: { type: mongoose.Schema.Types.ObjectId, ref: 'LecturerFormula' },
    // Bank details (optional, can be added or changed later). Who changed them last is
    // remembered, because they decide where the salary money goes.
    bankName: { type: String, trim: true },
    bankBranch: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    accountHolder: { type: String, trim: true },
    bankUpdatedAt: { type: Date },
    bankUpdatedByName: { type: String },
  },
  { timestamps: true }
);

// A batch (e.g. Management 2024). The super admin can add a new batch year
// whenever one starts, so nothing about the years is hard-coded.
const lecturerBatchSchema = new mongoose.Schema(
  {
    // The course NAME (Management, Art, ...). Courses are added by the super admin.
    faculty: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    // The formula this batch's lecturers are paid by. Empty = the Standard formula.
    formula: { type: mongoose.Schema.Types.ObjectId, ref: 'LecturerFormula' },
    // OLD setting (a plain deduction %), no longer used. Kept only so old data can still be read;
    // it is replaced by choosing a formula.
    deductionPercent: { type: Number, default: 0, min: 0, max: 99 },
    lecturers: [lecturerSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Management 2024 can only exist once.
lecturerBatchSchema.index({ faculty: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LecturerBatch', lecturerBatchSchema);