const mongoose = require('mongoose');

// The TOTAL DAYS of a month, only saved when it was changed from the calendar days
// (28 / 29 / 30 / 31). No document = the calendar days of that month are used.
const attendanceMonthSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "2026-11"
    totalDays: { type: Number, required: true, min: 1, max: 31 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceMonth', attendanceMonthSchema);