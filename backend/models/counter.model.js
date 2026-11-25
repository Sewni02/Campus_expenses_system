const mongoose = require('mongoose');

// Tiny atomic counter, used for running numbers such as petty cash voucher
// numbers (key 'pcv-2026' -> 1, 2, 3 ...). findOneAndUpdate with $inc is
// atomic, so two vouchers created at the same moment never get the same number.
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);