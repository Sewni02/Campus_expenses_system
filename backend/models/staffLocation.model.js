const mongoose = require('mongoose');

// A place where staff work (e.g. "Head Office", "Kelani Hostel"). Staff members
// belong to exactly one location, and the Staff Salary tab is organised by it.
// This is separate from OfficeLocation on purpose: the office expense bill
// types hang off that one, and the two lists should not affect each other.
const staffLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StaffLocation', staffLocationSchema);