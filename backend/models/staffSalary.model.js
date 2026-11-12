const mongoose = require('mongoose');
const partSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, maxlength: 20 },
    label: { type: String, maxlength: 40 },
    fullDays: { type: Number, min: 0, default: 0 },
    halfDays: { type: Number, min: 0, default: 0 },
    daySalary: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const lineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 0 },
    days: { type: Number, min: 0 }, // total days of all parts (a half day counts as 0.5)
    daySalary: { type: Number, min: 0 }, // only on lines saved by an older version (before parts)
    parts: [partSchema],
    rate: { type: Number, min: 0, max: 100 }, // EPF / ETF: the % used
    base: { type: Number, min: 0 }, // EPF / ETF: the amount the % was taken from (basic, or basic + holiday payments)
  },
  { _id: false }
);

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