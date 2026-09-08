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

const hardwareSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  phone: { type: String, required: true },
  items: [itemSchema],
  orders: [orderSchema],
}, { timestamps: true });

module.exports = mongoose.model('Hardware', hardwareSchema);