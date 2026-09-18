const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 0 },
});

const orderSchema = new mongoose.Schema({
  items: [
    {
      itemId: mongoose.Schema.Types.ObjectId,
      name: String,
      unitPrice: Number,
      quantity: Number,
    },
  ],
  total: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

// A bill received from this hardware supplier + the bank payment made
// against it, tagged with the project it was bought for.
//
// `status` tracks whether this recorded payment has been confirmed by
// finance yet. New records start 'pending'; existing records saved before
// this field existed have no status at all, and are treated as already
// 'paid' (see confirmPayment / the isConfirmed check on the frontend) since
// they were already fully filled in (bill + slip) at the time they were
// recorded.
const paymentSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  referenceNo: { type: String },
  bills: [{ url: String, name: String }],
  // Kept for backward compatibility with old single-bill records.
  billUrl: { type: String },
  slipUrl: { type: String },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  note: { type: String },
  // No default here on purpose: existing records saved before this field
  // existed have no status in the database, and Mongoose applies schema
  // defaults even to documents hydrated from existing data - so a default
  // of 'pending' would make old, already-settled payments look pending.
  // New records get 'pending' set explicitly by addPayment() instead; a
  // missing status is treated as already 'paid' wherever it's read.
  status: { type: String, enum: ['pending', 'paid'] },
});

// Same "invoice first" flow as contractor payments:
// 1) An invoice is raised against this hardware supplier for a project
//    (status: 'pending'). Only invoice-side details exist at this point -
//    amount, reason, the bill received from the supplier, etc. No bank/
//    payment info yet.
// 2) Once the invoice has been sent to finance and actually paid, it is
//    marked 'paid' and the payment/bank details (reference no, account,
//    bank, branch, slip, payment date) are attached to the SAME record.
// So one record = one invoice, end-to-end. This is separate from the
// `payments` array above, which is the supplier's own direct bill+payment
// log used on the Hardware tab.
const invoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  note: { type: String },
  billUrl: { type: String }, // the invoice/bill received from the supplier
  projectName: { type: String, required: true },

  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  invoiceDate: { type: Date, default: Date.now }, // when the invoice was raised

  // Only populated once the invoice has actually been paid (see payInvoice)
  paymentDate: { type: Date },
  referenceNo: { type: String },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  slipUrl: { type: String },
  paymentNote: { type: String },
}, { timestamps: true });

const hardwareSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  phone: { type: String, required: true },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  items: [itemSchema],
  orders: [orderSchema],
  payments: [paymentSchema],
  invoices: [invoiceSchema],
}, { timestamps: true });

module.exports = mongoose.model('Hardware', hardwareSchema);