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
    // Running number printed on the allocation voucher, e.g. FA-2026-0001.
    referenceNo: { type: String, index: true },
    // How the fund was handed over, plus an optional cheque / transfer number.
    method: { type: String, enum: ['cash', 'bank_transfer', 'bank_deposit', 'cheque'], default: 'cash' },
    paymentRef: { type: String, trim: true },
    // The day the super admin actually handed over / transferred the money.
    fundDate: { type: Date },
    // Bank slip (bank transfer / bank deposit) - uploaded by the super admin,
    // viewable by the accountant it was issued to.
    slipUrl: { type: String },
    slipFileName: { type: String },
    // 'pending'  = issued by the super admin, not yet confirmed by the accountant
    // 'received' = accountant confirmed they got it (only then it counts in the balance).
    // Records created before this flow existed have no status and count as received.
    status: { type: String, enum: ['pending', 'received'], default: 'received' },
    receivedAt: { type: Date },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    allocatedByName: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PettyCashAllocation', pettyCashAllocationSchema);