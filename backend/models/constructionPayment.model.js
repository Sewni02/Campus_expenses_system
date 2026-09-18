const mongoose = require('mongoose');

// Same "invoice first" flow as contractor and hardware payments:
// 1) An invoice is raised for a general construction payment (status:
//    'pending'). Only invoice-side details exist at this point - title,
//    amount, who it's paid to, the project, the bill received, etc. No
//    bank/payment info yet.
// 2) Once the invoice has been sent to finance and actually paid, it is
//    marked 'paid' and the payment/bank details (reference no, account,
//    bank, branch, slip, payment date) are attached to the SAME record.
// So one record = one invoice, end-to-end - never a separate invoice +
// payment pair. `status` is what drives which details are shown for it.
const constructionPaymentSchema = new mongoose.Schema({
  invoiceNo: { type: String },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  paidTo: { type: String },
  referenceNo: { type: String },
  projectName: { type: String, required: true },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  date: { type: Date, default: Date.now }, // when the invoice was raised
  billUrl: { type: String }, // the invoice/bill received
  description: { type: String },

  // No default here on purpose: existing records saved before this field
  // existed have no status at all, and Mongoose applies schema defaults
  // even to documents hydrated from existing data - so a default of
  // 'pending' would make old, already-settled payments look pending.
  // New records get 'pending' set explicitly by createInvoice() instead; a
  // missing status is treated as already 'paid' wherever it's read.
  status: { type: String, enum: ['pending', 'paid'] },

  // Only populated once the invoice has actually been paid (see payInvoice)
  paymentDate: { type: Date },
  slipUrl: { type: String },
  paymentNote: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ConstructionPayment', constructionPaymentSchema);