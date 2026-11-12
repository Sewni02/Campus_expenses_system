const mongoose = require('mongoose');

// One employee's attendance for ONE month.
//   normalDates -> the days of the month (1..31) the employee came on a normal working day
//   extraDates  -> the days of the month (1..31) the employee came and did EXTRA work
// Both kinds are arrival days:  arrivalDays = normalDays + extraDays.
// A day is never in both lists. The counts are stored so the sheet / reports need no recounting.
//
// Leaves of the month (kept separately, in whole or half days):
//   medicalLeave, casualLeave, noPayDays
//
// The arrival percentage and the arrival allowance are NOT stored: they are worked out when the sheet is
// opened, from arrivalDays, the total days of that month and the current allowance ranges.
const attendanceRecordSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true }, // "2026-11"
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceEmployee', required: true, index: true },
    normalDates: { type: [Number], default: [] },
    extraDates: { type: [Number], default: [] },
    normalDays: { type: Number, required: true, min: 0, default: 0 },
    extraDays: { type: Number, required: true, min: 0, default: 0 },
    arrivalDays: { type: Number, required: true, min: 0, default: 0 },
    medicalLeave: { type: Number, min: 0, max: 31, default: 0 },
    casualLeave: { type: Number, min: 0, max: 31, default: 0 },
    noPayDays: { type: Number, min: 0, max: 31, default: 0 },
  },
  { timestamps: true }
);

// One record per employee per month.
attendanceRecordSchema.index({ month: 1, employee: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);