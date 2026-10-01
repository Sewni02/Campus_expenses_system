const mongoose = require('mongoose');

// One fund the super admin gives to an accountant for a month
// (e.g. "Rs. 50,000 for 2026-10"). A month can have several allocations
// (top-ups); they are simply added together.
const pettyCashAllocationSchema = new mongoose.Schema(
  {
    accountant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Denormalized so old records still read fine if the user is renamed.
    accountantName: { type: String, required: true },
    // The month the fund is FOR, 'YYYY-MM'.
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    allocatedByName: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PettyCashAllocation', pettyCashAllocationSchema);