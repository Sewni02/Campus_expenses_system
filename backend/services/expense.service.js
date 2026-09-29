const Expense = require('../models/expense.model');
const { ApiError } = require('../utils/ApiError');

const listExpenses = async ({ category }) => {
  const filter = category ? { category: new RegExp(category, 'i') } : {};
  return Expense.find(filter).sort({ date: -1 });
};

const createExpense = async ({ title, amount, category, reason, description, date }, file) => {
  if (!title || !amount || !category) {
    throw new ApiError(400, 'title, amount, and category are required');
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'reason is required');
  }

  const bankSlipUrl = file ? file.path : undefined;

  const expense = await Expense.create({
    title, amount, category, reason, description, date, bankSlipUrl,
  });

  return { message: 'Expense added successfully', expense };
};

module.exports = { listExpenses, createExpense };