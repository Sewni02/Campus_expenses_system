const OfficeLocation = require('../models/officeLocation.model');
const OfficeExpense = require('../models/officeExpense.model');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, findOrFail } = require('../utils/ApiError');

// Seeded onto every location the first time it's created (either the
// built-in starter locations below, or a new one added via "+ Add
// Location") - each location then keeps its own independent bill-type
// list from that point on, so adding a bill type under one location never
// affects another.
const DEFAULT_BILL_TYPES = ['Electricity Bill', 'Water Bill', 'Telephone Bill', 'System Payment', 'Zoom Payment'];
const DEFAULT_LOCATIONS = ['KMC', 'Kelani Hostel', '171', 'Home'];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/office-expenses/locations
// Seeds the four starter locations (each with the default bill types) the
// first time this is ever called on a fresh database, so the dropdown is
// never empty out of the box.
const getLocations = asyncHandler(async (req, res) => {
  let locations = await OfficeLocation.find().sort({ name: 1 });

  if (locations.length === 0) {
    await OfficeLocation.insertMany(
      DEFAULT_LOCATIONS.map((name) => ({
        name,
        billTypes: DEFAULT_BILL_TYPES.map((btName) => ({ name: btName })),
      }))
    );
    locations = await OfficeLocation.find().sort({ name: 1 });
  }

  res.json(locations);
});

// POST /api/office-expenses/locations  { name }
const addLocation = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Location name is required');
  }

  const existing = await OfficeLocation.findOne({ name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') });
  if (existing) {
    throw new ApiError(409, 'This location already exists');
  }

  const location = await OfficeLocation.create({
    name: name.trim(),
    billTypes: DEFAULT_BILL_TYPES.map((btName) => ({ name: btName })),
  });

  res.status(201).json({ message: 'Location added successfully', location });
});

// POST /api/office-expenses/locations/:locationId/bill-types  { name }
const addBillType = asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Bill type name is required');
  }

  const location = await findOrFail(OfficeLocation, locationId, 'Location not found');

  const alreadyExists = location.billTypes.some((bt) => bt.name.toLowerCase() === name.trim().toLowerCase());
  if (alreadyExists) {
    throw new ApiError(409, 'This bill type already exists for this location');
  }

  location.billTypes.push({ name: name.trim() });
  await location.save();

  res.status(201).json({ message: 'Bill type added successfully', location });
});

// GET /api/office-expenses?location=<id>
const getExpenses = asyncHandler(async (req, res) => {
  const { location } = req.query;
  const filter = location ? { location } : {};
  const expenses = await OfficeExpense.find(filter).sort({ createdAt: -1 });
  res.json(expenses);
});

// POST /api/office-expenses (multipart: location, billType, billCode, bill file)
// Step 1 of the flow: raise the bill. Only bill-side details exist at this
// point - status 'pending', no amount/payment info yet.
const createExpense = asyncHandler(async (req, res) => {
  const { location, billType, billCode } = req.body;

  if (!location) throw new ApiError(400, 'location is required');
  if (!billType || !billType.trim()) throw new ApiError(400, 'billType is required');
  if (!billCode || !billCode.trim()) throw new ApiError(400, 'billCode is required');

  const locationDoc = await findOrFail(OfficeLocation, location, 'Location not found');

  const expense = await OfficeExpense.create({
    location: locationDoc._id,
    locationName: locationDoc.name,
    billType: billType.trim(),
    billCode: billCode.trim(),
    billFileUrl: req.file?.path,
    billFileName: req.file?.originalname,
    status: 'pending',
  });

  res.status(201).json({ message: 'Bill added successfully', expense });
});

// PATCH /api/office-expenses/:id/pay
// Step 2: record the bank payment made against a pending bill - this is
// also the first time amount is recorded at all. Flips status to 'paid'.
const markAsPaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { bankName, accountNumber, referenceNo, date, amount } = req.body;

  if (!amount) throw new ApiError(400, 'amount is required');
  if (!referenceNo || !referenceNo.trim()) throw new ApiError(400, 'referenceNo is required to mark this as paid');

  const expense = await findOrFail(OfficeExpense, id, 'Bill not found');
  if (expense.status === 'paid') {
    throw new ApiError(400, 'This bill has already been marked as paid');
  }

  expense.status = 'paid';
  expense.amount = amount;
  expense.date = date || Date.now();
  expense.bankName = bankName;
  expense.accountNumber = accountNumber;
  expense.referenceNo = referenceNo;
  await expense.save();

  res.json({ message: 'Bill marked as paid', expense });
});

// PUT /api/office-expenses/:id — edit the bill code/file (pending or paid)
// and, once paid, the payment details too.
const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { billCode, bankName, accountNumber, referenceNo, date, amount } = req.body;

  const expense = await findOrFail(OfficeExpense, id, 'Bill not found');

  if (billCode !== undefined && billCode !== '') expense.billCode = billCode;
  if (req.file) {
    expense.billFileUrl = req.file.path;
    expense.billFileName = req.file.originalname;
  }

  if (expense.status === 'paid') {
    if (bankName !== undefined) expense.bankName = bankName;
    if (accountNumber !== undefined) expense.accountNumber = accountNumber;
    if (referenceNo !== undefined) expense.referenceNo = referenceNo;
    if (date) expense.date = date;
    if (amount !== undefined && amount !== '') expense.amount = amount;
  }

  await expense.save({ validateModifiedOnly: true });

  res.json({ message: 'Bill updated successfully', expense });
});

// DELETE /api/office-expenses/:id
const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const expense = await OfficeExpense.findByIdAndDelete(id);
  if (!expense) throw new ApiError(404, 'Bill not found');
  res.json({ message: 'Bill deleted successfully' });
});

module.exports = {
  getLocations,
  addLocation,
  addBillType,
  getExpenses,
  createExpense,
  markAsPaid,
  updateExpense,
  deleteExpense,
};