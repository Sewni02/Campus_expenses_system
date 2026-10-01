const mongoose = require('mongoose');
const User = require('../models/user.model');
const Counter = require('../models/counter.model');
const PettyCashAllocation = require('../models/pettyCashAllocation.model');
const PettyCashExpense = require('../models/pettyCashExpense.model');
const { ApiError } = require('../utils/ApiError');
const { requireString, optionalString, validateAmount } = require('../utils/validators');

const PERMISSION = 'petty_cash_manage';
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORIES = [
  'Stationery',
  'Refreshments',
  'Transport',
  'Cleaning',
  'Repairs & Maintenance',
  'Postage & Courier',
  'Utilities',
  'Miscellaneous',
];

// true  -> a voucher bigger than the remaining balance is still saved, but
//          flagged "overdrawn" (the super admin sees it in the month-end analysis).
// false -> such a voucher is refused outright.
const ALLOW_OVERSPEND = true;

// A month with less than this share of its funds left is shown as "low".
const LOW_BALANCE_RATIO = 0.1;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Today in Sri Lanka as 'YYYY-MM-DD' (so the month rolls over at local midnight).
const todayString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const currentMonth = () => todayString().slice(0, 7);

const validateMonth = (value, field = 'month') => {
  if (value === undefined || value === null || value === '') return currentMonth();
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) {
    throw new ApiError(400, `${field} must look like 2026-10`);
  }
  return value;
};

const validateDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new ApiError(400, 'date is required');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'date is not a valid date');
  }
  if (value > todayString()) {
    throw new ApiError(400, 'date cannot be in the future');
  }
  return { date: parsed, month: value.slice(0, 7) };
};

// ---------------------------------------------------------------------------
// Balance maths
// ---------------------------------------------------------------------------
// For one month M:
//   opening  = everything allocated BEFORE M  - everything spent BEFORE M
//   closing  = opening + allocated in M       - spent in M
// So whatever is left at the end of a month carries into the next one, and a
// month that ended overdrawn starts the next month already in the red.

// Groups a collection by accountant, split into "before month" and "in month".
const sumsByAccountant = (Model, dateField, month, match = {}) =>
  Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$accountant',
        before: { $sum: { $cond: [{ $lt: [`$${dateField}`, month] }, '$amount', 0] } },
        during: { $sum: { $cond: [{ $eq: [`$${dateField}`, month] }, '$amount', 0] } },
        count: { $sum: { $cond: [{ $eq: [`$${dateField}`, month] }, 1, 0] } },
        overdrawnCount: {
          $sum: {
            $cond: [{ $and: [{ $eq: [`$${dateField}`, month] }, { $eq: ['$overdrawn', true] }] }, 1, 0],
          },
        },
      },
    },
  ]);

const buildFigures = (allocRow, spentRow) => {
  const opening = round2((allocRow?.before || 0) - (spentRow?.before || 0));
  const allocated = round2(allocRow?.during || 0);
  const spent = round2(spentRow?.during || 0);
  const available = round2(opening + allocated);
  const closing = round2(available - spent);
  const usedPercent = available > 0 ? round2((spent / available) * 100) : spent > 0 ? 100 : 0;

  let status = 'ok';
  if (closing < 0) status = 'overspent';
  else if (available > 0 && closing / available <= LOW_BALANCE_RATIO) status = 'low';

  return {
    opening,
    allocated,
    available,
    spent,
    closing,
    usedPercent,
    status,
    voucherCount: spentRow?.count || 0,
    overdrawnCount: spentRow?.overdrawnCount || 0,
  };
};

const getFigures = async (accountantId, month) => {
  const match = { accountant: toObjectId(accountantId) };
  const [allocRows, spentRows] = await Promise.all([
    sumsByAccountant(PettyCashAllocation, 'month', month, match),
    sumsByAccountant(PettyCashExpense, 'month', month, match),
  ]);
  return buildFigures(allocRows[0], spentRows[0]);
};

// ---------------------------------------------------------------------------
// Super admin: accountants + allocations
// ---------------------------------------------------------------------------
const getAccountants = async () => {
  const users = await User.find({
    status: 'approved',
    $or: [{ permissions: PERMISSION }, { permissions: '*' }],
    role: { $ne: 'super_admin' },
  })
    .select('name email department')
    .sort({ name: 1 });
  return users;
};

const createAllocation = async (adminUser, body) => {
  const accountantId = requireString(body.accountant, 'accountant', { max: 40 });
  const month = validateMonth(body.month || undefined);
  const amount = validateAmount(body.amount, 'amount');
  const note = optionalString(body.note, 'note', { max: 300 });

  if (!mongoose.isValidObjectId(accountantId)) throw new ApiError(404, 'Accountant not found');
  const accountant = await User.findById(accountantId).select('name status permissions role');
  if (!accountant || accountant.status !== 'approved' || !(accountant.permissions || []).includes(PERMISSION)) {
    throw new ApiError(400, 'That user is not an approved accountant (needs the "Petty Cash" permission)');
  }

  const admin = await User.findById(adminUser.id).select('name');

  const allocation = await PettyCashAllocation.create({
    accountant: accountant._id,
    accountantName: accountant.name,
    month,
    amount,
    note,
    allocatedBy: adminUser.id,
    allocatedByName: admin?.name,
  });

  return { message: 'Petty cash allocated successfully', allocation };
};

const buildAllocationFilter = ({ month, accountant }) => {
  const filter = {};
  if (month) filter.month = validateMonth(month);
  if (accountant) {
    if (typeof accountant !== 'string' || !mongoose.isValidObjectId(accountant)) {
      throw new ApiError(400, 'accountant is not valid');
    }
    filter.accountant = accountant;
  }
  return filter;
};

const listAllocations = async (query) =>
  PettyCashAllocation.find(buildAllocationFilter(query)).sort({ month: -1, createdAt: -1 }).limit(500);

const deleteAllocation = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Allocation not found');
  const allocation = await PettyCashAllocation.findByIdAndDelete(id);
  if (!allocation) throw new ApiError(404, 'Allocation not found');
  return { message: 'Allocation removed' };
};

// ---------------------------------------------------------------------------
// Accountant: expenses (vouchers)
// ---------------------------------------------------------------------------
const nextVoucherNo = async (year) => {
  const counter = await Counter.findOneAndUpdate(
    { key: `pcv-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PCV-${year}-${String(counter.seq).padStart(4, '0')}`;
};

const createExpense = async (user, body) => {
  const { date, month } = validateDate(body.date);
  const payee = requireString(body.payee, 'payee (paid to)', { max: 120 });
  const description = requireString(body.description, 'description', { max: 300 });
  const amount = validateAmount(body.amount, 'amount');

  const category = requireString(body.category, 'category', { max: 60 });
  if (!CATEGORIES.includes(category)) throw new ApiError(400, 'category is not valid');

  // What was left just before this payment? Use the voucher's own month so a
  // back-dated voucher is compared against that month's funds.
  const figures = await getFigures(user.id, month);
  const balanceBefore = figures.closing;
  const balanceAfter = round2(balanceBefore - amount);
  const overdrawn = balanceAfter < 0;

  if (overdrawn && !ALLOW_OVERSPEND) {
    throw new ApiError(400, `Not enough petty cash. Balance for ${month} is Rs. ${balanceBefore.toFixed(2)}`);
  }

  const accountant = await User.findById(user.id).select('name');
  const voucherNo = await nextVoucherNo(date.getUTCFullYear());

  const expense = await PettyCashExpense.create({
    voucherNo,
    accountant: user.id,
    accountantName: accountant?.name || 'Accountant',
    date,
    month,
    payee,
    category,
    description,
    amount,
    balanceBefore,
    balanceAfter,
    overdrawn,
  });

  return {
    message: overdrawn
      ? 'Voucher issued, but it is more than the remaining petty cash balance'
      : 'Voucher issued successfully',
    expense,
    figures: await getFigures(user.id, month),
  };
};

const buildExpenseFilter = ({ month, accountant, category }) => {
  const filter = {};
  if (month) filter.month = validateMonth(month);
  if (accountant) {
    if (typeof accountant !== 'string' || !mongoose.isValidObjectId(accountant)) {
      throw new ApiError(400, 'accountant is not valid');
    }
    filter.accountant = accountant;
  }
  if (category) {
    if (typeof category !== 'string' || !CATEGORIES.includes(category)) {
      throw new ApiError(400, 'category is not valid');
    }
    filter.category = category;
  }
  return filter;
};

const listExpenses = async (query, forcedAccountantId) => {
  const filter = buildExpenseFilter(query);
  if (forcedAccountantId) filter.accountant = forcedAccountantId; // accountants only ever see their own
  return PettyCashExpense.find(filter).sort({ date: -1, createdAt: -1 }).limit(500);
};

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------
const getMySummary = async (user, query) => {
  const month = validateMonth(query.month);
  const figures = await getFigures(user.id, month);
  return { month, isCurrentMonth: month === currentMonth(), ...figures };
};

const previousMonthOf = (month) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

// The month-end analysis for the super admin: every accountant's opening /
// allocated / spent / closing balance, which ones overspent, where the money
// went (by category) and the biggest vouchers.
const getAdminSummary = async (query) => {
  const month = validateMonth(query.month);
  const prevMonth = previousMonthOf(month);

  const [allocRows, spentRows, categories, topExpenses, overdrawnVouchers, prevSpent, accountants] =
    await Promise.all([
      sumsByAccountant(PettyCashAllocation, 'month', month),
      sumsByAccountant(PettyCashExpense, 'month', month),
      PettyCashExpense.aggregate([
        { $match: { month } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      PettyCashExpense.find({ month }).sort({ amount: -1 }).limit(5),
      PettyCashExpense.find({ month, overdrawn: true }).sort({ date: 1 }),
      PettyCashExpense.aggregate([
        { $match: { month: prevMonth } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      getAccountants(),
    ]);

  // Include anyone who has money / spending on record even if their
  // permission was removed later.
  const ids = new Map(accountants.map((a) => [String(a._id), { name: a.name, email: a.email }]));
  const extraIds = [...allocRows, ...spentRows].map((r) => String(r._id)).filter((id) => !ids.has(id));
  if (extraIds.length) {
    const extras = await User.find({ _id: { $in: extraIds } }).select('name email');
    extras.forEach((u) => ids.set(String(u._id), { name: u.name, email: u.email }));
  }

  const rows = [...ids.entries()].map(([id, info]) => ({
    accountantId: id,
    name: info.name,
    email: info.email,
    ...buildFigures(
      allocRows.find((r) => String(r._id) === id),
      spentRows.find((r) => String(r._id) === id)
    ),
  }));

  const sum = (key) => round2(rows.reduce((total, r) => total + r[key], 0));
  const totals = {
    opening: sum('opening'),
    allocated: sum('allocated'),
    available: sum('available'),
    spent: sum('spent'),
    closing: sum('closing'),
    voucherCount: rows.reduce((t, r) => t + r.voucherCount, 0),
    overdrawnCount: rows.reduce((t, r) => t + r.overdrawnCount, 0),
  };
  totals.usedPercent =
    totals.available > 0 ? round2((totals.spent / totals.available) * 100) : totals.spent > 0 ? 100 : 0;

  const previousSpent = round2(prevSpent[0]?.total || 0);

  return {
    month,
    isCurrentMonth: month === currentMonth(),
    totals,
    accountants: rows,
    categories: categories.map((c) => ({
      category: c._id,
      total: round2(c.total),
      count: c.count,
      percent: totals.spent > 0 ? round2((c.total / totals.spent) * 100) : 0,
    })),
    topExpenses,
    overdrawnVouchers,
    previousMonth: {
      month: prevMonth,
      spent: previousSpent,
      // + means more was spent this month than last month
      changePercent: previousSpent > 0 ? round2(((totals.spent - previousSpent) / previousSpent) * 100) : null,
    },
  };
};

module.exports = {
  CATEGORIES,
  getAccountants,
  createAllocation,
  listAllocations,
  deleteAllocation,
  createExpense,
  listExpenses,
  getMySummary,
  getAdminSummary,
};