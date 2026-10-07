const mongoose = require('mongoose');

// One salary ENTRY for one lecturer in one month. A lecturer can have more than one
// entry in the same month (e.g. paid in two parts, or a formula salary plus a fixed one).
//   type 'formula': amount = the chosen formula worked out with attendance / subFee / percentage
//   type 'fixed'  : amount = the fixed amount typed in
// Rates are COPIED into the entry, so changing a lecturer's rates later never changes
// entries that were already calculated.
const lecturerSalarySchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'LecturerBatch', required: true, index: true },
    lecturer: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Copied too, so the record still reads fine if the batch/lecturer is changed later.
    faculty: { type: String },
    batchYear: { type: Number },
    lecturerName: { type: String, required: true },
    subject: { type: String, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    type: { type: String, enum: ['formula', 'fixed'], default: 'formula' },
    // Which part of the batch: online / physical / recording. One lecturer can be paid for all three.
    mode: { type: String, enum: ['online', 'physical', 'recording'] },
    // The formula used (a COPY of its name + expression, so later edits never change this entry).
    formula: { type: mongoose.Schema.Types.ObjectId, ref: 'LecturerFormula' },
    formulaName: { type: String },
    expression: { type: String },
    attendance: { type: Number, min: 0 },
    subFee: { type: Number, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    // The salary BEFORE the batch deduction, the deduction % used, and the final amount.
    grossAmount: { type: Number, min: 0 },
    deductionPercent: { type: Number, default: 0, min: 0, max: 99 },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
    // pending   = draft: being entered (can be edited / deleted)
    // submitted = accountant finalised it, waiting for the super admin to check
    // verified  = super admin checked and approved, ready to be paid
    // paid      = money paid out
    status: { type: String, enum: ['pending', 'submitted', 'verified', 'paid'], default: 'pending' },
    submittedAt: { type: Date },
    submittedByName: { type: String },
    verifiedAt: { type: Date },
    verifiedByName: { type: String },
    // Why the super admin sent it back to draft (shown to the accountant).
    returnNote: { type: String },
    paidDate: { type: Date },
    // Entries paid together (one lecturer, one month, all their batches) share this id.
    paymentId: { type: mongoose.Schema.Types.ObjectId },
    paidByName: { type: String },
    // Bank details the lecturer had at the moment of payment (they may be changed later).
    paidBankName: { type: String },
    paidBankBranch: { type: String },
    paidAccountNumber: { type: String },
    paidAccountHolder: { type: String },
    calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

lecturerSalarySchema.index({ month: 1, batch: 1 });
lecturerSalarySchema.index({ paymentId: 1 });

module.exports = mongoose.model('LecturerSalary', lecturerSalarySchema);