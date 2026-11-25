const User = require('../models/user.model');
const Contractor = require('../models/contractor.model');
const ConstructionPayment = require('../models/constructionPayment.model');
const Hardware = require('../models/hardware.model');
const OfficeLocation = require('../models/officeLocation.model');
const OfficeExpense = require('../models/officeExpense.model');
const PettyCashAllocation = require('../models/pettyCashAllocation.model');
const PettyCashExpense = require('../models/pettyCashExpense.model');
const { listProjectNames } = require('./project.service');
const { getGrandTotals } = require('./grandTotal.service');

// Powers the chart on the public landing page.
//
// It counts the real records in each module, but ONLY the proportions leave
// this file. Raw counts are never returned, so a visitor (who is not logged in)
// can see the shape of the system but not how many records it holds.
//
// The module names + order must match the legend on the landing page.
const PETTY_CASH_PERMISSION = 'petty_cash_manage';

// The page is public, so cache the result for a short while. Many visitors
// then share one set of database queries instead of triggering their own.
const CACHE_MS = 60 * 1000;
let cache = { at: 0, data: null };

const countContractorPayments = async () => {
  const [row] = await Contractor.aggregate([
    { $group: { _id: null, total: { $sum: { $size: { $ifNull: ['$payments', []] } } } } },
  ]);
  return row ? row.total : 0;
};

const countModules = async () => {
  const [
    users,
    contractors,
    constructionPayments,
    contractorPayments,
    suppliers,
    { projectNames },
    locations,
    bills,
    accountants,
    funds,
    vouchers,
  ] = await Promise.all([
    User.countDocuments(),
    Contractor.countDocuments(),
    ConstructionPayment.countDocuments(),
    countContractorPayments(),
    Hardware.countDocuments(),
    listProjectNames(),
    OfficeLocation.countDocuments(),
    OfficeExpense.countDocuments(),
    User.countDocuments({ status: 'approved', permissions: PETTY_CASH_PERMISSION }),
    PettyCashAllocation.countDocuments(),
    PettyCashExpense.countDocuments(),
  ]);

  return [
    { name: 'User Management', total: users },
    {
      name: 'Constructions',
      total: contractors + constructionPayments + contractorPayments + suppliers + projectNames.length,
    },
    { name: 'Office Expenses', total: locations + bills },
    { name: 'Petty Cash', total: accountants + funds + vouchers },
  ];
};

const getSystemOverview = async () => {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const modules = await countModules();
  const grandTotal = modules.reduce((t, m) => t + m.total, 0);

  const data = {
    modules: modules.map((m) => ({
      name: m.name,
      share: grandTotal > 0 ? Number((m.total / grandTotal).toFixed(4)) : 0,
    })),
    updatedAt: new Date().toISOString(),
  };

  cache = { at: Date.now(), data };
  return data;
};

// ---------------------------------------------------------------------------
// Landing page "live overview": money spent THIS MONTH and YEAR-TO-DATE.
//
// Only totals leave this file (per function, per month) - never individual
// payments, names, invoices or bank details. Built from the same numbers as
// the Grand Total tab, so the landing page and the dashboard always agree.
// Cached for a minute because the page is public.
// ---------------------------------------------------------------------------
const FUNCTIONS = ['constructions', 'officeExpenses', 'pettyCash', 'lecturerSalary', 'staffSalary'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

let summaryCache = { at: 0, data: null };

const emptyTotals = () => {
  const row = { grandTotal: 0 };
  FUNCTIONS.forEach((f) => { row[f] = 0; });
  return row;
};

const pickTotals = (row) => {
  const out = emptyTotals();
  if (!row) return out;
  FUNCTIONS.forEach((f) => { out[f] = round2(row[f]); });
  out.grandTotal = round2(row.grandTotal);
  return out;
};

const getLandingSummary = async () => {
  if (summaryCache.data && Date.now() - summaryCache.at < CACHE_MS) return summaryCache.data;

  const now = new Date();
  const year = now.getUTCFullYear();
  const currentMonth = now.toISOString().slice(0, 7); // 'YYYY-MM'
  const currentMonthNumber = now.getUTCMonth() + 1;

  const { months } = await getGrandTotals();
  const byMonth = new Map(months.map((m) => [m.month, m]));

  // January .. the month the page is being opened in. Months with no spending are zeros.
  const monthly = [];
  const yearToDate = emptyTotals();
  for (let m = 1; m <= currentMonthNumber; m += 1) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const row = pickTotals(byMonth.get(key));
    monthly.push({ month: key, grandTotal: row.grandTotal });
    FUNCTIONS.forEach((f) => { yearToDate[f] = round2(yearToDate[f] + row[f]); });
    yearToDate.grandTotal = round2(yearToDate.grandTotal + row.grandTotal);
  }

  const data = {
    year,
    month: currentMonth,
    thisMonth: pickTotals(byMonth.get(currentMonth)),
    yearToDate,
    monthly,
    updatedAt: now.toISOString(),
  };

  summaryCache = { at: Date.now(), data };
  return data;
};

module.exports = { getSystemOverview, getLandingSummary };