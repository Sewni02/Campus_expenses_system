const mongoose = require('mongoose');

const estimationPlanSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  totalEstimate: { type: Number, required: true },
  planFileUrl: { type: String },
  note: { type: String },
  uploadedDate: { type: Date, default: Date.now },
});

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  note: { type: String },
  paymentType: {
    type: String,
    enum: ['direct_slip', 'bill_then_payment'],
    default: 'direct_slip',
  },
  billUrl: { type: String },
  slipUrl: { type: String },
  referenceNo: { type: String },
  planId: { type: mongoose.Schema.Types.ObjectId },
  projectName: { type: String },
});

const contractorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now },
  estimationPlans: [estimationPlanSchema],
  payments: [paymentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Contractor', contractorSchema);