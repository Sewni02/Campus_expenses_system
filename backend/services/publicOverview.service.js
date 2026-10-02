const User = require('../models/user.model');
const Contractor = require('../models/contractor.model');
const ConstructionPayment = require('../models/constructionPayment.model');
const Hardware = require('../models/hardware.model');
const OfficeLocation = require('../models/officeLocation.model');
const OfficeExpense = require('../models/officeExpense.model');
const PettyCashAllocation = require('../models/pettyCashAllocation.model');
const PettyCashExpense = require('../models/pettyCashExpense.model');
const { listProjectNames } = require('./project.service');

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

module.exports = { getSystemOverview };