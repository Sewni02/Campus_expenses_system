const mongoose = require('mongoose');

// One office-expense bill, e.g. "KMC - Electricity Bill - BILL/2026/09".
//
// Created with just the bill-side details (location, bill type, bill code,
// the uploaded bill file) and status 'pending'. The payment-side details
// (bank, account, reference no, date, amount) don't exist yet at that
// point - they're only attached once someone clicks "Mark as Paid" and
// fills them in, which is also when the amount is first recorded (the
// amount isn't known/entered at bill-upload time).
const officeExpenseSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeLocation', required: true },
    // Denormalized so the record still reads sensibly even if the location
    // is ever renamed or removed later.
    locationName: { type: String, required: true },
    billType: { type: String, required: true },
    billCode: { type: String, required: true, trim: true },
    billFileUrl: { type: String },
    billFileName: { type: String },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },

    // --- Payment-side details, filled in by "Mark as Paid" ---
    amount: { type: Number },
    date: { type: Date },
    bankName: { type: String },
    accountNumber: { type: String },
    referenceNo: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OfficeExpense', officeExpenseSchema);