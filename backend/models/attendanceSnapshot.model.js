const mongoose = require('mongoose');

// A SAVED COPY of one month's attendance report of ONE location - exactly the numbers that were on the
// sheet the last time it was saved ("Save attendance"):
//   - the employees (employee number + name as they were then),
//   - the days typed for each of them, the arrival % and the arrival allowance (Rs.),
//   - the TOTAL DAYS of the month, and
//   - the ALLOWANCE RANGES that were used.
//
// Why it exists: the live sheet is worked out again every time it is opened, from the CURRENT allowance
// ranges and the CURRENT list of employees. Without this copy, editing the allowance ranges (or renaming /
// removing an employee) would silently change the figures of months that were already finished.
// With it:
//   * the "Saved months" list can show every past month and open it again,
//   * the PDF of a past month always has the same figures it had when it was saved,
//   * the ranges of a month stay frozen until the accountant presses "Use current ranges".
//
// The typed numbers themselves still live in AttendanceRecord (one per employee per month).
const rowSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember' },
    employeeNo: { type: String, default: '' },
    name: { type: String, default: '' },
    arrivedDays: { type: Number, default: 0 },
    extraDays: { type: Number, default: 0 },
    arrivalDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    medicalLeave: { type: Number, default: 0 },
    casualLeave: { type: Number, default: 0 },
    noPayDays: { type: Number, default: 0 },
    arrivalPercentage: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
  },
  { _id: false }
);

const rangeSchema = new mongoose.Schema(
  {
    minPercent: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const attendanceSnapshotSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "2026-11"
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffLocation', required: true },
    locationName: { type: String, default: '' },
    totalDays: { type: Number, required: true, min: 1, max: 31 },
    ranges: { type: [rangeSchema], default: [] },
    rows: { type: [rowSchema], default: [] },
    totalAllowance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One saved copy per month and location.
attendanceSnapshotSchema.index({ month: 1, location: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceSnapshot', attendanceSnapshotSchema);