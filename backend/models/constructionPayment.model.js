const mongoose = require('mongoose');

const constructionPaymentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  paidTo: { type: String },
  // So this "other" payment can be rolled up into a project's summary
  // alongside contractor and hardware payments.
  projectName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  billUrl: { type: String },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ConstructionPayment', constructionPaymentSchema);