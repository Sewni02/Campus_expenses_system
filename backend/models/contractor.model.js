const mongoose = require('mongoose');

const estimationPlanSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  totalEstimate: { type: Number, required: true },
  planFileUrl: { type: String },
  note: { type: String },
  uploadedDate: { type: Date, default: Date.now },
});

// Every contractor payment now goes through an "invoice first" flow:
// 1) An invoice is raised for a contractor's estimation plan (status: 'pending').
//    Only invoice-side details exist at this point - amount, reason, the bill
//    file received from the contractor, etc. No bank/payment info yet.
// 2) Once the invoice has been sent to finance and actually paid, it is marked
//    'paid' and the payment/bank details (reference no, account, bank, branch,
//    slip, payment date) are attached to the SAME record.
// So one record = one invoice, end-to-end - never a separate invoice + payment
// pair. `status` is what drives which details are shown for it.
const paymentSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  note: { type: String },
  billUrl: { type: String }, // the invoice/bill received from the contractor
  planId: { type: mongoose.Schema.Types.ObjectId },
  projectName: { type: String },

  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  invoiceDate: { type: Date, default: Date.now }, // when the invoice was raised

  
  paymentDate: { type: Date },
  referenceNo: { type: String },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  slipUrl: { type: String },
  paymentNote: { type: String },
}, { timestamps: true });

const contractorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  registrationDate: { type: Date, default: Date.now },
  estimationPlans: [estimationPlanSchema],
  payments: [paymentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Contractor', contractorSchema);