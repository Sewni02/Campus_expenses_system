const Expense = require('../models/expense.model');

const getExpenses = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category: new RegExp(category, 'i') } : {};
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { title, amount, category, reason, description, date } = req.body;

    if (!title || !amount || !category) {
      return res.status(400).json({ message: 'title, amount, and category are required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const bankSlipUrl = req.file ? req.file.path : undefined;

    const expense = await Expense.create({
      title, amount, category, reason, description, date, bankSlipUrl,
    });

    res.status(201).json({ message: 'Expense added successfully', expense });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getExpenses, createExpense };