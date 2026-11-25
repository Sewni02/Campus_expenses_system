const mongoose = require('mongoose');

// Which staff members are on the attendance sheet of ONE location.
// The sheet keeps the order the employees were added in, so `staff` is an ordered list.
const attendanceSelectionSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffLocation', required: true },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StaffMember' }],
  },
  { timestamps: true }
);

// One selection per location (attendance.service.js retries on E11000 when two first-time saves race).
attendanceSelectionSchema.index({ location: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceSelection', attendanceSelectionSchema);