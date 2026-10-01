const asyncHandler = require('../utils/asyncHandler');
const pettyCashService = require('../services/pettyCash.service');

// ----- Accountant (own data only) -----
// GET /api/petty-cash/categories
const getCategories = asyncHandler(async (req, res) => {
  res.json(pettyCashService.CATEGORIES);
});

// GET /api/petty-cash/me/summary?month=2026-10
const getMySummary = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getMySummary(req.user, req.query));
});

// GET /api/petty-cash/me/allocations?month=
const getMyAllocations = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.listAllocations({ ...req.query, accountant: req.user.id }));
});

// GET /api/petty-cash/me/expenses?month=&category=
const getMyExpenses = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.listExpenses(req.query, req.user.id));
});

// POST /api/petty-cash/me/expenses  { date, payee, category, description, amount }
const createExpense = asyncHandler(async (req, res) => {
  const result = await pettyCashService.createExpense(req.user, req.body);
  res.status(201).json(result);
});

// ----- Super admin -----
// GET /api/petty-cash/admin/accountants
const getAccountants = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getAccountants());
});

// POST /api/petty-cash/admin/allocations  { accountant, month, amount, note }
const createAllocation = asyncHandler(async (req, res) => {
  const result = await pettyCashService.createAllocation(req.user, req.body);
  res.status(201).json(result);
});

// GET /api/petty-cash/admin/allocations?month=&accountant=
const getAllocations = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.listAllocations(req.query));
});

// DELETE /api/petty-cash/admin/allocations/:id
const deleteAllocation = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.deleteAllocation(req.params.id));
});

// GET /api/petty-cash/admin/expenses?month=&accountant=&category=
const getAllExpenses = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.listExpenses(req.query));
});

// GET /api/petty-cash/admin/summary?month=2026-10  (month-end analysis)
const getAdminSummary = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getAdminSummary(req.query));
});

module.exports = {
  getCategories,
  getMySummary,
  getMyAllocations,
  getMyExpenses,
  createExpense,
  getAccountants,
  createAllocation,
  getAllocations,
  deleteAllocation,
  getAllExpenses,
  getAdminSummary,
};