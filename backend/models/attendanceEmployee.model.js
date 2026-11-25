const mongoose = require('mongoose');

// One employee on the attendance sheet. The list is permanent: an employee added once is on the
// sheet of EVERY month until he / she is deleted (the monthly sheet itself lives in AttendanceRecord).
const attendanceEmployeeSchema = new mongoose.Schema(
  {
    // The employee number written on the sheet, e.g. "E001". Stored in capitals, unique.
    employeeNo: { type: String, required: true, trim: true, uppercase: true, maxlength: 20, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceEmployee', attendanceEmployeeSchema);