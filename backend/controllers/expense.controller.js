const Expense = require('../models/expense.model');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const getExpenses = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category: new RegExp(category, 'i') } : {};
  const expenses = await Expense.find(filter).sort({ date: -1 });
  res.json(expenses);
});

const createExpense = asyncHandler(async (req, res) => {
  const { title, amount, category, reason, description, date } = req.body;

  if (!title || !amount || !category) {
    throw new ApiError(400, 'title, amount, and category are required');
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'reason is required');
  }

  const bankSlipUrl = req.file ? req.file.path : undefined;

  const expense = await Expense.create({
    title, amount, category, reason, description, date, bankSlipUrl,
  });

  res.status(201).json({ message: 'Expense added successfully', expense });
});

module.exports = { getExpenses, createExpense };