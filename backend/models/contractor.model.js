const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String },
  paymentType: {
    type: String,
    enum: ['direct_slip', 'bill_then_payment'],
    default: 'direct_slip',
  },
  billUrl: { type: String },   // used when paymentType = bill_then_payment
  slipUrl: { type: String },   // bank payment slip (used in both cases)
});

const contractorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now },
  payments: [paymentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Contractor', contractorSchema);