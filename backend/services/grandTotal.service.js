const ConstructionPayment = require('../models/constructionPayment.model');
const Contractor = require('../models/contractor.model');
const Hardware = require('../models/hardware.model');
const OfficeExpense = require('../models/officeExpense.model');
const PettyCashExpense = require('../models/pettyCashExpense.model');
const LecturerSalary = require('../models/lecturerSalary.model');
const StaffSalary = require('../models/staffSalary.model');
const ApiError = require('../utils/ApiError');

// Grand Total (super admin dashboard)
//
// For every month it adds up what was actually SPENT by each function:
//   constructions    = PAID construction payments + PAID contractor payments + hardware supplier payments / invoices
//                      (month = the day it was paid)
//   officeExpenses   = PAID office bills (month = the month the bill is FOR; old bills without one use the payment date)
//   pettyCash        = petty cash vouchers (month of the voucher). Funds given to accountants are NOT added,
//                      otherwise the same money would be counted twice (fund + the vouchers spent from it).
//   lecturerSalary   = lecturer salaries with status 'paid' (month = the salary month)
//   staffSalary      = NET salary of every saved staff salary (month = the salary month)
//
// Pending / unpaid items are never counted.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const FUNCTIONS = ['constructions', 'officeExpenses', 'pettyCash', 'lecturerSalary', 'staffSalary'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Date -> 'YYYY-MM'. Dates are stored at UTC midnight, so read them in UTC (they never shift a day).
const monthOf = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 7);
};

// A record saved before the `status` field existed has no status and counts as already paid.
const isPaid = (status) => status === undefined || status === null || status === 'paid';

const buildMonths = async () => {
  const months = new Map();
  const add = (month, fn, amount) => {
    if (!month || !MONTH_PATTERN.test(month)) return;
    const value = Number(amount);
    if (!Number.isFinite(value)) return;
    if (!months.has(month)) {
      const row = { month };
      FUNCTIONS.forEach((f) => { row[f] = 0; });
      months.set(month, row);
    }
    months.get(month)[fn] += value;
  };

  const [constructionPayments, contractors, hardware, officeExpenses, pettyCash, lecturerSalaries, staffSalaries] =
    await Promise.all([
      ConstructionPayment.find().select('amount status paymentDate date').lean(),
      Contractor.find().select('payments.amount payments.status payments.paymentDate payments.invoiceDate').lean(),
      Hardware.find()
        .select('payments.amount payments.status payments.date invoices.amount invoices.status invoices.paymentDate invoices.invoiceDate')
        .lean(),
      OfficeExpense.find({ status: 'paid' }).select('amount billMonth date billDate createdAt').lean(),
      PettyCashExpense.find().select('amount month').lean(),
      LecturerSalary.find({ status: 'paid' }).select('amount month').lean(),
      StaffSalary.find().select('netSalary month').lean(),
    ]);

  // Constructions: general construction payments
  constructionPayments.forEach((p) => {
    if (!isPaid(p.status)) return;
    add(monthOf(p.paymentDate || p.date), 'constructions', p.amount);
  });

  // Constructions: contractor payments (invoice first flow; only 'paid' ones)
  contractors.forEach((c) => {
    (c.payments || []).forEach((p) => {
      if (p.status !== 'paid') return;
      add(monthOf(p.paymentDate || p.invoiceDate), 'constructions', p.amount);
    });
  });

  // Constructions: hardware suppliers (direct payments + paid invoices)
  hardware.forEach((h) => {
    (h.payments || []).forEach((p) => {
      if (!isPaid(p.status)) return;
      add(monthOf(p.date), 'constructions', p.amount);
    });
    (h.invoices || []).forEach((inv) => {
      if (inv.status !== 'paid') return;
      add(monthOf(inv.paymentDate || inv.invoiceDate), 'constructions', inv.amount);
    });
  });

  // Office expenses (paid bills)
  officeExpenses.forEach((e) => {
    const month = MONTH_PATTERN.test(e.billMonth || '') ? e.billMonth : monthOf(e.date || e.billDate || e.createdAt);
    add(month, 'officeExpenses', e.amount);
  });

  // Petty cash vouchers
  pettyCash.forEach((e) => add(e.month, 'pettyCash', e.amount));

  // Lecturer salaries (paid)
  lecturerSalaries.forEach((s) => add(s.month, 'lecturerSalary', s.amount));

  // Staff salaries (net)
  staffSalaries.forEach((s) => add(s.month, 'staffSalary', s.netSalary));

  return [...months.values()]
    .map((row) => {
      const out = { month: row.month };
      let grandTotal = 0;
      FUNCTIONS.forEach((f) => {
        out[f] = round2(row[f]);
        grandTotal += out[f];
      });
      out.grandTotal = round2(grandTotal);
      return out;
    })
    .sort((a, b) => b.month.localeCompare(a.month)); // newest month first
};

// GET /api/grand-total            -> every month that has any spending (newest first)
// GET /api/grand-total?month=2026-10 -> the same, plus `selected` = that month (all zeros if nothing was spent)
const getGrandTotals = async ({ month } = {}) => {
  if (month !== undefined && month !== '' && !MONTH_PATTERN.test(month)) {
    throw new ApiError(400, 'month must look like 2026-10');
  }

  const months = await buildMonths();

  const sum = (key) => round2(months.reduce((t, m) => t + m[key], 0));
  const allTime = { month: 'all' };
  FUNCTIONS.forEach((f) => { allTime[f] = sum(f); });
  allTime.grandTotal = sum('grandTotal');

  let selected = null;
  if (month) {
    selected = months.find((m) => m.month === month) || { month, grandTotal: 0 };
    FUNCTIONS.forEach((f) => { if (selected[f] === undefined) selected[f] = 0; });
  }

  return { months, allTime, selected };
};

module.exports = { getGrandTotals };