const mongoose = require('mongoose');

// One employee's attendance for ONE month - the numbers of the paper "Monthly Attendance Report", typed in
// (whole or half days: 25, 25.5 ...):
//   arrivedDays  -> Arrived Days
//   extraDays    -> the extra work days (worked on a day off) - also arrival days
//   leaveDays    -> Leave (the days not worked that are not medical or casual leave)
//   medicalLeave -> M
//   casualLeave  -> C
//   noPayDays    -> (NO PAY)
// arrivalDays = arrivedDays + extraDays  (kept so reports need no recounting).
//
// The arrival percentage and the arrival allowance are NOT stored: they are worked out when the sheet is
// opened, from arrivalDays, the total days of that month and the current allowance ranges.
const attendanceRecordSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true }, // "2026-11"
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember', required: true, index: true }, // a staff member from Staff & Locations
    arrivedDays: { type: Number, min: 0, max: 31, default: 0 },
    extraDays: { type: Number, min: 0, max: 31, default: 0 },
    arrivalDays: { type: Number, min: 0, max: 62, default: 0 },
    leaveDays: { type: Number, min: 0, max: 31, default: 0 },
    medicalLeave: { type: Number, min: 0, max: 31, default: 0 },
    casualLeave: { type: Number, min: 0, max: 31, default: 0 },
    noPayDays: { type: Number, min: 0, max: 31, default: 0 },
  },
  { timestamps: true }
);

// One record per employee per month.
attendanceRecordSchema.index({ month: 1, employee: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);