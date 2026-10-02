const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const asyncHandler = require('../utils/asyncHandler');
const { removeUploadedFiles } = require('../utils/cleanupUploads');
const pettyCashService = require('../services/pettyCash.service');

// ----- Accountant (own data only) -----
// GET /api/petty-cash/categories
const getCategories = asyncHandler(async (req, res) => {
  res.json(pettyCashService.CATEGORIES);
});

// GET /api/petty-cash/me/dashboard?month=2026-10  (summary + funds + vouchers + pending, one request)
const getMyDashboard = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getMyDashboard(req.user, req.query));
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

// POST /api/petty-cash/me/allocations/:id/receive  (accountant confirms a fund reached them)
const receiveAllocation = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.receiveAllocation(req.user, req.params.id));
});

// GET /api/petty-cash/me/allocations/pending  (funds waiting for the accountant to accept)
const getMyPendingAllocations = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getMyPendingAllocations(req.user));
});

// GET /api/petty-cash/me/allocations/:id/slip     (accountant, own funds only)
// GET /api/petty-cash/admin/allocations/:id/slip  (super admin)
// Streams the uploaded bank slip back to the browser.
const streamSlip = (asAdmin) =>
  asyncHandler(async (req, res) => {
    const { upstream, fileName } = await pettyCashService.resolveSlipDownload(req.user, req.params.id, asAdmin);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);

    await pipeline(Readable.fromWeb(upstream.body), res);
  });
const getMySlip = streamSlip(false);
const getAdminSlip = streamSlip(true);

// ----- Super admin -----
// GET /api/petty-cash/admin/accountants
const getAccountants = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getAccountants());
});

// POST /api/petty-cash/admin/allocations  (multipart)
//   { accountant, month, fundDate, amount, method, paymentRef, note, slip(file) }
const createAllocation = asyncHandler(async (req, res) => {
  try {
    const result = await pettyCashService.createAllocation(req.user, req.body, req.file);
    res.status(201).json(result);
  } catch (err) {
    // The slip is already in Cloudinary - delete it if the fund was not saved.
    await removeUploadedFiles(req);
    throw err;
  }
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

// GET /api/petty-cash/admin/report?from=2026-10-01&to=2026-10-31&accountant=<id>
//   No accountant = overall report (everyone). No from/to = all time.
const getAdminReport = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getReport(req.query));
});

// GET /api/petty-cash/me/report?from=&to=  (accountant's own report)
const getMyReport = asyncHandler(async (req, res) => {
  res.json(await pettyCashService.getMyReport(req.user, req.query));
});

module.exports = {
  getCategories,
  getMySummary,
  getMyDashboard,
  getMyAllocations,
  receiveAllocation,
  getMyPendingAllocations,
  getMySlip,
  getAdminSlip,
  getMyExpenses,
  createExpense,
  getAccountants,
  createAllocation,
  getAllocations,
  deleteAllocation,
  getAllExpenses,
  getAdminSummary,
  getAdminReport,
  getMyReport,
};