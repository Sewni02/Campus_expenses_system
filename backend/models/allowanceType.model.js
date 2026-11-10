const mongoose = require('mongoose');

// One kind of allowance (Skill Allowance, Performance, Transport ...).
//
// This is ONE shared list for every employee. The monthly salary form shows every
// type for the selected employee (the accountant chooses Yes / No, and "No" is saved
// as 0), so a type added here automatically appears for every employee.
const allowanceTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AllowanceType', allowanceTypeSchema);