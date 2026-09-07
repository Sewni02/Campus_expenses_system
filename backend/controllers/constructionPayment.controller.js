const ConstructionPayment = require('../models/constructionPayment.model');

const getPayments = async (req, res) => {
  try {
    const payments = await ConstructionPayment.find().sort({ date: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createPayment = async (req, res) => {
  try {
    const { title, amount, paidTo, description, date } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ message: 'title and amount are required' });
    }

    const billUrl = req.file ? req.file.path : undefined;

    const payment = await ConstructionPayment.create({
      title, amount, paidTo, description, date, billUrl,
    });

    res.status(201).json({ message: 'Payment added successfully', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPayments, createPayment };