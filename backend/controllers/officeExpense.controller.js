const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const asyncHandler = require('../utils/asyncHandler');
const officeExpenseService = require('../services/officeExpense.service');

// GET /api/office-expenses/locations
const getLocations = asyncHandler(async (req, res) => {
  const locations = await officeExpenseService.getLocations();
  res.json(locations);
});

// POST /api/office-expenses/locations  { name }
const addLocation = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.addLocation(req.body);
  res.status(201).json(result);
});

// POST /api/office-expenses/locations/:locationId/bill-types  { name }
const addBillType = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.addBillType(req.params.locationId, req.body);
  res.status(201).json(result);
});

// DELETE /api/office-expenses/locations/:locationId
const deleteLocation = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.deleteLocation(req.params.locationId);
  res.json(result);
});

// DELETE /api/office-expenses/locations/:locationId/bill-types/:billTypeId
const deleteBillType = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.deleteBillType(req.params.locationId, req.params.billTypeId);
  res.json(result);
});

// GET /api/office-expenses?location=<id>
const getExpenses = asyncHandler(async (req, res) => {
  const expenses = await officeExpenseService.getExpenses(req.query);
  res.json(expenses);
});

// POST /api/office-expenses (multipart: location, billType, billCode, billMonth, billDate, description, bill file)
const createExpense = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.createExpense(req.body, req.file);
  res.status(201).json(result);
});

// PATCH /api/office-expenses/:id/pay (multipart: bank details + optional `slip` file - PDF/JPG)
const markAsPaid = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.markAsPaid(req.params.id, req.body, req.file);
  res.json(result);
});

// PUT /api/office-expenses/:id — edit the bill code/date/description/file (pending
// or paid) and, once paid, the payment details and bank slip too.
const updateExpense = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.updateExpense(req.params.id, req.body, req.files);
  res.json(result);
});

// GET /api/office-expenses/:id/download            -> the bill
// GET /api/office-expenses/:id/download?file=slip  -> the bank slip
// Streams the uploaded file back to the browser as a real file download.
// The service resolves WHERE the bytes come from; this controller's job is
// purely HTTP: set the right headers and pipe the stream to the response.
const downloadBill = asyncHandler(async (req, res) => {
  const isSlip = req.query.file === 'slip';
  const { upstream, fileName } = await officeExpenseService.resolveDownload(req.params.id, isSlip);

  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  );
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);

  await pipeline(Readable.fromWeb(upstream.body), res);
});

// DELETE /api/office-expenses/:id
const deleteExpense = asyncHandler(async (req, res) => {
  const result = await officeExpenseService.deleteExpense(req.params.id);
  res.json(result);
});

module.exports = {
  getLocations,
  addLocation,
  addBillType,
  deleteLocation,
  deleteBillType,
  getExpenses,
  createExpense,
  markAsPaid,
  updateExpense,
  downloadBill,
  deleteExpense,
};