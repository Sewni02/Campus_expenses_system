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
    const { title, amount, paidTo, referenceNo, description, date, projectName, accountNumber, bankName, bankBranch } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ message: 'title and amount are required' });
    }
    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ message: 'projectName is required' });
    }
    if (!referenceNo || !referenceNo.trim()) {
      return res.status(400).json({ message: 'referenceNo is required' });
    }

    const billUrl = req.file ? req.file.path : undefined;

    const payment = await ConstructionPayment.create({
      title, amount, paidTo, referenceNo, description, date, billUrl, projectName,
      accountNumber, bankName, bankBranch,
    });

    res.status(201).json({ message: 'Payment added successfully', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await ConstructionPayment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPayments, createPayment, deletePayment };