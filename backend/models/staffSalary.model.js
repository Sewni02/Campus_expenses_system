const mongoose = require('mongoose');

// One allowance or one deduction line, e.g. { name: 'Transport', amount: 5000 }.
// The Holiday Payments line also keeps how it was worked out: amount = days x daySalary.
const lineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 0 },
    days: { type: Number, min: 0 },
    daySalary: { type: Number, min: 0 },
  },
  { _id: false }
);

// One monthly salary for one staff member.
//   gross = basic salary + allowances
//   net   = gross - deductions
// The staff member's name / NIC / location / basic salary are COPIED into the record,
// so changing the profile later (or deleting the person) never changes a salary
// that was already created.
const staffSalarySchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffLocation', required: true },
    locationName: { type: String, required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', required: true },
    staffName: { type: String, required: true },
    nic: { type: String },
    basicSalary: { type: Number, required: true, min: 0 },
    allowances: [lineSchema],
    deductions: [lineSchema],
    totalAllowances: { type: Number, required: true, min: 0, default: 0 },
    totalDeductions: { type: Number, required: true, min: 0, default: 0 },
    grossSalary: { type: Number, required: true, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One salary per person per month (edit it instead of creating a second one).
staffSalarySchema.index({ staff: 1, month: 1 }, { unique: true });
staffSalarySchema.index({ month: 1, location: 1 });

module.exports = mongoose.model('StaffSalary', staffSalarySchema);