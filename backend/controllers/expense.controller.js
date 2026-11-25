const asyncHandler = require('../utils/asyncHandler');
const expenseService = require('../services/expense.service');

const getExpenses = asyncHandler(async (req, res) => {
  const expenses = await expenseService.listExpenses(req.query);
  res.json(expenses);
});

const createExpense = asyncHandler(async (req, res) => {
  const result = await expenseService.createExpense(req.body, req.file);
  res.status(201).json(result);
});

module.exports = { getExpenses, createExpense };