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
    // The date printed on the bill (chosen in the "Add New Bill" form) and a
    // free-text note about what the bill is for.
    billDate: { type: Date },
    // Which month the bill is FOR, stored as 'YYYY-MM' (e.g. '2026-08' for the
    // August bill) - so an August bill paid in September is still easy to tell apart.
    billMonth: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    description: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },

    // --- Payment-side details, filled in by "Mark as Paid" ---
    amount: { type: Number },
    date: { type: Date },
    bankName: { type: String },
    accountNumber: { type: String },
    referenceNo: { type: String },
    // Optional bank slip (PDF / JPG) uploaded when the bill is marked as paid.
    slipUrl: { type: String },
    slipFileName: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OfficeExpense', officeExpenseSchema);