const mongoose = require('mongoose');

const constructionPaymentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  paidTo: { type: String },
  referenceNo: { type: String, required: true },
  projectName: { type: String, required: true },
  accountNumber: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  date: { type: Date, default: Date.now },
  billUrl: { type: String },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ConstructionPayment', constructionPaymentSchema);