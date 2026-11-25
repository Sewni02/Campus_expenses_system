const mongoose = require('mongoose');

// One petty cash payment = one voucher. Created by the accountant; the
// voucher PDF is generated from this record on the frontend.
const pettyCashExpenseSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true }, // e.g. PCV-2026-0001
    accountant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountantName: { type: String, required: true },

    date: { type: Date, required: true },
    // 'YYYY-MM' of `date` - what balances and month-end reports group by.
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true },

    payee: { type: String, required: true, trim: true }, // who was paid
    category: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },

    // Snapshot taken when the voucher was issued, so "did this payment push
    // the balance below zero?" can still be answered later.
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    overdrawn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PettyCashExpense', pettyCashExpenseSchema);