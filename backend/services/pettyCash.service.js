const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const User = require('../models/user.model');
const Counter = require('../models/counter.model');
const PettyCashAllocation = require('../models/pettyCashAllocation.model');
const PettyCashExpense = require('../models/pettyCashExpense.model');
const { ApiError } = require('../utils/ApiError');
const { requireString, optionalString, validateAmount } = require('../utils/validators');

const PERMISSION = 'petty_cash_manage';
const ALLOCATION_METHODS = ['cash', 'bank_transfer', 'bank_deposit', 'cheque'];
// For these the super admin MUST attach the bank slip.
const SLIP_REQUIRED_METHODS = ['bank_transfer', 'bank_deposit'];
// Funds only count toward a balance once the accountant has confirmed receipt.
// (Old records without a status count as received.)
const RECEIVED_ONLY = { status: { $ne: 'pending' } };
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
    sumsByAccountant(PettyCashAllocation, 'month', month, { ...match, ...RECEIVED_ONLY }),
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

const createAllocation = async (adminUser, body, file) => {
  const accountantId = requireString(body.accountant, 'accountant', { max: 40 });
  const month = validateMonth(body.month || undefined);
  const amount = validateAmount(body.amount, 'amount');
  const note = optionalString(body.note, 'note', { max: 300 });
  const method = body.method || 'cash';
  if (!ALLOCATION_METHODS.includes(method)) throw new ApiError(400, 'method is not valid');
  const paymentRef = optionalString(body.paymentRef, 'reference', { max: 60 });
  if (SLIP_REQUIRED_METHODS.includes(method) && !file) {
    throw new ApiError(400, 'Please upload the bank slip for a bank transfer / bank deposit');
  }
  const fundDate = validateDate(body.fundDate || todayString()).date;

  if (!mongoose.isValidObjectId(accountantId)) throw new ApiError(404, 'Accountant not found');
  const accountant = await User.findById(accountantId).select('name status permissions role');
  if (!accountant || accountant.status !== 'approved' || !(accountant.permissions || []).includes(PERMISSION)) {
    throw new ApiError(400, 'That user is not an approved accountant (needs the "Petty Cash" permission)');
  }

  const admin = await User.findById(adminUser.id).select('name');

  const referenceNo = await nextAllocationNo(new Date().getUTCFullYear());

  const allocation = await PettyCashAllocation.create({
    accountant: accountant._id,
    accountantName: accountant.name,
    month,
    amount,
    note,
    referenceNo,
    method,
    paymentRef,
    fundDate,
    slipUrl: file?.path,
    slipFileName: file?.originalname,
    status: 'pending',
    allocatedBy: adminUser.id,
    allocatedByName: admin?.name,
  });

  return {
    message: `Fund ${referenceNo} issued. It will be added to the balance once the accountant confirms receipt`,
    allocation,
  };
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

// Only a fund the accountant has not confirmed yet can be cancelled; once it
// is received it stays on record.
const deleteAllocation = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Allocation not found');
  const allocation = await PettyCashAllocation.findById(id);
  if (!allocation) throw new ApiError(404, 'Allocation not found');
  if (allocation.status !== 'pending') {
    throw new ApiError(400, 'This fund has already been received by the accountant and cannot be removed');
  }
  await allocation.deleteOne();
  await removeSlipFromStorage(allocation.slipUrl);
  return { message: 'Allocation cancelled' };
};

// The accountant confirms the money / cheque / transfer actually reached them.
const receiveAllocation = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Allocation not found');
  const allocation = await PettyCashAllocation.findOne({ _id: id, accountant: user.id });
  if (!allocation) throw new ApiError(404, 'Allocation not found');
  if (allocation.status !== 'pending') throw new ApiError(400, 'This fund is already confirmed');
  allocation.status = 'received';
  allocation.receivedAt = new Date();
  await allocation.save();
  return {
    message: `Fund ${allocation.referenceNo || ''} accepted and added to the ${allocation.month} petty cash balance`.replace('  ', ' '),
    allocation,
  };
};

// Every fund still waiting for this accountant's confirmation, whatever month it is for.
const getMyPendingAllocations = async (user) =>
  PettyCashAllocation.find({ accountant: user.id, status: 'pending' }).sort({ createdAt: -1 }).limit(100);

// ---------------------------------------------------------------------------
// Bank slips (stored in Cloudinary, streamed back through the API)
// ---------------------------------------------------------------------------
// Splits a stored Cloudinary URL into the pieces Cloudinary's signed API needs.
const parseCloudinaryUrl = (url) => {
  const match = /\/(image|video|raw)\/(upload|authenticated|private)\/(?:v\d+\/)?([^?#]+)/.exec(url || '');
  if (!match) return null;
  const [, resourceType, type, rawPath] = match;
  const path = decodeURIComponent(rawPath);
  if (resourceType === 'raw') return { resourceType, type, publicId: path, format: '' };
  const dot = path.lastIndexOf('.');
  if (dot === -1) return { resourceType, type, publicId: path, format: '' };
  return { resourceType, type, publicId: path.slice(0, dot), format: path.slice(dot + 1) };
};

// Best effort - never throws (a cancelled fund should still cancel if Cloudinary hiccups).
const removeSlipFromStorage = async (slipUrl) => {
  const parsed = parseCloudinaryUrl(slipUrl);
  if (!parsed) return;
  try {
    await cloudinary.uploader.destroy(parsed.publicId, { resource_type: parsed.resourceType, type: parsed.type });
  } catch (err) {
    console.error('Could not remove slip from storage:', err.message);
  }
};

// Finds the slip of one allocation and fetches its bytes. An accountant can only
// open slips of funds issued to them; the super admin can open any.
const resolveSlipDownload = async (user, id, asAdmin) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Allocation not found');
  const allocation = await PettyCashAllocation.findOne(asAdmin ? { _id: id } : { _id: id, accountant: user.id });
  if (!allocation) throw new ApiError(404, 'Allocation not found');
  if (!allocation.slipUrl) throw new ApiError(404, 'No slip was uploaded for this fund');

  const candidates = [];
  const parsed = parseCloudinaryUrl(allocation.slipUrl);
  if (parsed) {
    try {
      candidates.push(
        cloudinary.utils.private_download_url(parsed.publicId, parsed.format, {
          resource_type: parsed.resourceType,
          type: parsed.type,
          attachment: true,
          expires_at: Math.floor(Date.now() / 1000) + 300,
        })
      );
    } catch (err) {
      console.error('Could not build signed Cloudinary URL:', err.message);
    }
  }
  candidates.push(allocation.slipUrl);

  let upstream = null;
  let lastStatus = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (response.ok && response.body) {
        upstream = response;
        break;
      }
      lastStatus = response.status;
    } catch (err) {
      console.error('Slip download: could not reach storage:', err.message);
    }
  }
  if (!upstream) {
    throw new ApiError(502, `Could not fetch the slip from storage${lastStatus ? ` (status ${lastStatus})` : ''}. Please try again.`);
  }

  const urlExt = (allocation.slipUrl.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/) || [])[1];
  let fileName = (allocation.slipFileName || '').trim() || `${allocation.referenceNo || 'fund'}-slip`;
  if (!/\.[A-Za-z0-9]{2,5}$/.test(fileName) && urlExt) fileName += `.${urlExt}`;
  return { upstream, fileName };
};

// ---------------------------------------------------------------------------
// Accountant: expenses (vouchers)
// ---------------------------------------------------------------------------
const nextAllocationNo = async (year) => {
  const counter = await Counter.findOneAndUpdate(
    { key: `pcf-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FA-${year}-${String(counter.seq).padStart(4, '0')}`;
};

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

// Everything the accountant's page needs in ONE call (instead of 4 separate
// requests that each re-check the login against the database). All the queries
// run in parallel, so the page waits for the slowest one, not the sum of them.
const getMyDashboard = async (user, query) => {
  const month = validateMonth(query.month);
  const [figures, allocations, expenses, pending] = await Promise.all([
    getFigures(user.id, month),
    listAllocations({ month, accountant: user.id }),
    listExpenses({ month }, user.id),
    getMyPendingAllocations(user),
  ]);
  return {
    summary: { month, isCurrentMonth: month === currentMonth(), ...figures },
    allocations,
    expenses,
    pending,
  };
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
      sumsByAccountant(PettyCashAllocation, 'month', month, RECEIVED_ONLY),
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

// ---------------------------------------------------------------------------
// Reports: any date range, for ALL accountants (overall) or ONE accountant
// ---------------------------------------------------------------------------
// Vouchers are placed in a period by their voucher date; funds by the day the
// money was handed over (fundDate - older records fall back to the day they
// were created). Only funds the accountant has CONFIRMED count in the money
// figures; unconfirmed ones are listed and shown as "pending".
const REPORT_ROW_LIMIT = 5000;
const FUND_DATE = { $ifNull: ['$fundDate', '$createdAt'] };
const DAY_MS = 24 * 60 * 60 * 1000;

const parseReportRange = ({ from, to }) => {
  const parse = (value, field) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
      throw new ApiError(400, `${field} must look like 2026-10-31`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new ApiError(400, `${field} is not a valid date`);
    }
    return parsed;
  };
  const start = parse(from, 'from');
  const lastDay = parse(to, 'to');
  if (start && lastDay && start > lastDay) throw new ApiError(400, 'from cannot be after to');
  // `end` is exclusive (the day after the last day of the range).
  return { start, end: lastDay ? new Date(lastDay.getTime() + DAY_MS) : null, from: from || null, to: to || null };
};

// Like sumsByAccountant, but for an arbitrary [start, end) range instead of one month.
const sumsByAccountantInRange = (Model, dateExpr, start, end, match = {}) => {
  const before = start ? { $lt: [dateExpr, start] } : { $literal: false };
  const inRange = {
    $and: [
      { $literal: true },
      ...(start ? [{ $gte: [dateExpr, start] }] : []),
      ...(end ? [{ $lt: [dateExpr, end] }] : []),
    ],
  };
  return Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$accountant',
        before: { $sum: { $cond: [before, '$amount', 0] } },
        during: { $sum: { $cond: [inRange, '$amount', 0] } },
        count: { $sum: { $cond: [inRange, 1, 0] } },
        overdrawnCount: { $sum: { $cond: [{ $and: [inRange, { $eq: ['$overdrawn', true] }] }, 1, 0] } },
      },
    },
  ]);
};

const getReport = async (query, forcedAccountantId) => {
  const { start, end, from, to } = parseReportRange(query);

  let accountantId = null;
  if (forcedAccountantId) {
    accountantId = String(forcedAccountantId); // accountants only ever see their own
  } else if (query.accountant) {
    if (typeof query.accountant !== 'string' || !mongoose.isValidObjectId(query.accountant)) {
      throw new ApiError(400, 'accountant is not valid');
    }
    accountantId = query.accountant;
  }
  const match = accountantId ? { accountant: toObjectId(accountantId) } : {};

  const expenseFilter = { ...match };
  if (start || end) {
    expenseFilter.date = {};
    if (start) expenseFilter.date.$gte = start;
    if (end) expenseFilter.date.$lt = end;
  }
  const fundConds = [];
  if (start) fundConds.push({ $gte: [FUND_DATE, start] });
  if (end) fundConds.push({ $lt: [FUND_DATE, end] });
  const allocationFilter = { ...match, ...(fundConds.length ? { $expr: { $and: fundConds } } : {}) };

  const [expenses, allocations, allocRows, spentRows, categoryRows, approvedAccountants] = await Promise.all([
    PettyCashExpense.find(expenseFilter).sort({ date: 1, createdAt: 1 }).limit(REPORT_ROW_LIMIT),
    PettyCashAllocation.find(allocationFilter).limit(REPORT_ROW_LIMIT),
    sumsByAccountantInRange(PettyCashAllocation, FUND_DATE, start, end, { ...match, ...RECEIVED_ONLY }),
    sumsByAccountantInRange(PettyCashExpense, '$date', start, end, match),
    PettyCashExpense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    accountantId ? Promise.resolve([]) : getAccountants(),
  ]);

  allocations.sort(
    (a, b) => new Date(a.fundDate || a.createdAt) - new Date(b.fundDate || b.createdAt)
  );

  // Who appears in the report: the one accountant asked for, or every accountant
  // (plus anyone with money on record whose permission was removed later).
  const people = new Map(approvedAccountants.map((a) => [String(a._id), { name: a.name, email: a.email }]));
  if (accountantId) people.set(accountantId, null);
  const missing = [...people.keys(), ...[...allocRows, ...spentRows].map((r) => String(r._id))].filter(
    (id, i, all) => !people.get(id) && all.indexOf(id) === i
  );
  if (missing.length) {
    const users = await User.find({ _id: { $in: missing } }).select('name email');
    users.forEach((u) => people.set(String(u._id), { name: u.name, email: u.email }));
  }
  if (accountantId && !people.get(accountantId)) throw new ApiError(404, 'Accountant not found');

  const allRows = [...people.entries()]
    .filter(([, info]) => info)
    .map(([id, info]) => ({
      accountantId: id,
      name: info.name,
      email: info.email,
      ...buildFigures(
        allocRows.find((r) => String(r._id) === id),
        spentRows.find((r) => String(r._id) === id)
      ),
    }));
  // In the overall report leave out accountants with nothing at all in this range.
  const rows = accountantId
    ? allRows
    : allRows.filter((r) => r.opening || r.allocated || r.spent || r.voucherCount);
  rows.sort((a, b) => a.name.localeCompare(b.name));

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

  const pending = allocations.filter((a) => a.status === 'pending');

  return {
    range: { from, to },
    scope: accountantId ? 'accountant' : 'overall',
    accountant: accountantId ? { id: accountantId, ...people.get(accountantId) } : null,
    totals,
    pendingFunds: { count: pending.length, amount: round2(pending.reduce((t, a) => t + a.amount, 0)) },
    accountants: rows,
    categories: categoryRows.map((c) => ({
      category: c._id,
      total: round2(c.total),
      count: c.count,
      percent: totals.spent > 0 ? round2((c.total / totals.spent) * 100) : 0,
    })),
    expenses,
    allocations,
    truncated: expenses.length >= REPORT_ROW_LIMIT || allocations.length >= REPORT_ROW_LIMIT,
  };
};

const getMyReport = (user, query) => getReport(query, user.id);

module.exports = {
  CATEGORIES,
  getAccountants,
  createAllocation,
  listAllocations,
  deleteAllocation,
  receiveAllocation,
  getMyPendingAllocations,
  resolveSlipDownload,
  createExpense,
  listExpenses,
  getMySummary,
  getMyDashboard,
  getAdminSummary,
  getReport,
  getMyReport,
};