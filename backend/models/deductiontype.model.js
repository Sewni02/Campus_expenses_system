const mongoose = require('mongoose');

// One kind of deduction (EPF, ETF, No-Pay Leave, Advances, Loans ...).
//
// ONE shared list for every employee, exactly like AllowanceType. The monthly salary form shows
// every type for the selected employee (Yes / No, "No" is saved as 0), so a type added here shows
// up for every employee automatically.
//
//   kind 'percent' -> amount = basic salary x rate / 100        (EPF 8%, ETF 3%)
//   kind 'days'    -> amount = days x day salary                 (No-Pay Leave)
//   kind 'amount'  -> the accountant types the amount            (Advances, Loans, new ones)
const deductionTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
    kind: { type: String, enum: ['percent', 'days', 'amount'], default: 'amount' },
    rate: { type: Number, min: 0, max: 100 }, // only for kind 'percent'
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeductionType', deductionTypeSchema);