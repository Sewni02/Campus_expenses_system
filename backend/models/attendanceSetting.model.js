const mongoose = require('mongoose');

// Settings of the attendance sheet - one document (key "allowance") that holds the ARRIVAL ALLOWANCE RANGES.
//
// Every range is "from minPercent % and above  ->  amount (Rs.)". The highest range that the employee's
// arrival percentage reaches is the one that applies; below the lowest range there is no allowance.
// Default ranges (created the first time they are needed, then editable on the sheet):
//     90% and above -> Rs. 5,000      (90% - 100%)
//     80% and above -> Rs. 4,000      (80% - below 90%)
//     70% and above -> Rs. 2,000      (70% - below 80%)
//     below 70%     -> nothing
const tierSchema = new mongoose.Schema(
  {
    minPercent: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const attendanceSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'allowance' },
    tiers: { type: [tierSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceSetting', attendanceSettingSchema);