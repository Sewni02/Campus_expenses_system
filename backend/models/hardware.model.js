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
const paymentSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  billUrl: { type: String },
  slipUrl: { type: String },
  referenceNo: { type: String },
  note: { type: String },
});

const hardwareSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  phone: { type: String, required: true },
  items: [itemSchema],
  orders: [orderSchema],
  payments: [paymentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Hardware', hardwareSchema);