const mongoose = require('mongoose');

// A bill type belongs to one specific location (e.g. "KMC" might have
// "Electricity Bill" while "Home" might not) - so this lives as a
// sub-document on the location itself rather than a separate global list.
const billTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
});

const officeLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    billTypes: [billTypeSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('OfficeLocation', officeLocationSchema);