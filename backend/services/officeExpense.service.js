const cloudinary = require('../config/cloudinary');
const OfficeLocation = require('../models/officeLocation.model');
const OfficeExpense = require('../models/officeExpense.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { validateAmount } = require('../utils/validators');

// Seeded onto every location the first time it's created (either the
// built-in starter locations below, or a new one added via "+ Add
// Location") - each location then keeps its own independent bill-type
// list from that point on, so adding a bill type under one location never
// affects another.
const DEFAULT_BILL_TYPES = ['Electricity Bill', 'Water Bill', 'Telephone Bill', 'System Payment', 'Zoom Payment'];
const DEFAULT_LOCATIONS = ['KMC', 'Kelani Hostel', '171', 'Home'];

// 'YYYY-MM' - the month a bill is for (from the bill month dropdown).
const BILL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Seeds the four starter locations (each with the default bill types) the
// first time this is ever called on a fresh database, so the dropdown is
// never empty out of the box.
const getLocations = async () => {
  let locations = await OfficeLocation.find().sort({ name: 1 });

  // Only seed a brand-new database - if bills already exist, an empty location
  // list just means everything was deleted on purpose.
  if (locations.length === 0 && (await OfficeExpense.countDocuments()) === 0) {
    await OfficeLocation.insertMany(
      DEFAULT_LOCATIONS.map((name) => ({
        name,
        billTypes: DEFAULT_BILL_TYPES.map((btName) => ({ name: btName })),
      }))
    );
    locations = await OfficeLocation.find().sort({ name: 1 });
  }

  return locations;
};

const addLocation = async ({ name }) => {
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

  return { message: 'Location added successfully', location };
};

const addBillType = async (locationId, { name }) => {
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

  return { message: 'Bill type added successfully', location };
};

// Removes the location and its bill types. Existing bills are kept - each one
// stores its own locationName / billType text, so they still read correctly.
const deleteLocation = async (locationId) => {
  const location = await findOrFail(OfficeLocation, locationId, 'Location not found');
  await location.deleteOne();
  return { message: 'Location deleted successfully' };
};

// Removes one bill type from this location only. Existing bills are kept.
const deleteBillType = async (locationId, billTypeId) => {
  const location = await findOrFail(OfficeLocation, locationId, 'Location not found');

  const exists = location.billTypes.some((bt) => String(bt._id) === String(billTypeId));
  if (!exists) throw new ApiError(404, 'Bill type not found');

  location.billTypes = location.billTypes.filter((bt) => String(bt._id) !== String(billTypeId));
  await location.save();

  return { message: 'Bill type deleted successfully', location };
};

const getExpenses = async ({ location }) => {
  const filter = location ? { location } : {};
  return OfficeExpense.find(filter).sort({ createdAt: -1 });
};

// Step 1 of the flow: raise the bill. Only bill-side details exist at this
// point - status 'pending', no amount/payment info yet.
const createExpense = async ({ location, billType, billCode, billMonth, billDate, description }, file) => {
  if (!location) throw new ApiError(400, 'location is required');
  if (!billType || !billType.trim()) throw new ApiError(400, 'billType is required');
  if (!billCode || !billCode.trim()) throw new ApiError(400, 'billCode is required');
  if (!billMonth || !BILL_MONTH_PATTERN.test(billMonth)) {
    throw new ApiError(400, 'billMonth is required (the month this bill is for, e.g. 2026-08)');
  }

  const locationDoc = await findOrFail(OfficeLocation, location, 'Location not found');

  const expense = await OfficeExpense.create({
    location: locationDoc._id,
    locationName: locationDoc.name,
    billType: billType.trim(),
    billCode: billCode.trim(),
    billFileUrl: file?.path,
    billFileName: file?.originalname,
    billMonth,
    billDate: billDate || undefined,
    description: description && description.trim() ? description.trim() : undefined,
    status: 'pending',
  });

  return { message: 'Bill added successfully', expense };
};

// Step 2: record the bank payment made against a pending bill - this is
// also the first time amount is recorded at all. Flips status to 'paid'.
const markAsPaid = async (id, { bankName, accountNumber, referenceNo, date, amount }, file) => {
  if (!amount) throw new ApiError(400, 'amount is required');
  if (!referenceNo || !referenceNo.trim()) throw new ApiError(400, 'referenceNo is required to mark this as paid');
  const cleanAmount = validateAmount(amount);

  const expense = await findOrFail(OfficeExpense, id, 'Bill not found');
  if (expense.status === 'paid') {
    throw new ApiError(400, 'This bill has already been marked as paid');
  }

  expense.status = 'paid';
  expense.amount = cleanAmount;
  expense.date = date || Date.now();
  expense.bankName = bankName;
  expense.accountNumber = accountNumber;
  expense.referenceNo = referenceNo;
  if (file) {
    expense.slipUrl = file.path;
    expense.slipFileName = file.originalname;
  }
  await expense.save();

  return { message: 'Bill marked as paid', expense };
};

// Edit the bill code/date/description/file (pending or paid) and, once
// paid, the payment details and bank slip too.
const updateExpense = async (id, { billCode, billMonth, billDate, description, bankName, accountNumber, referenceNo, date, amount }, files) => {
  const expense = await findOrFail(OfficeExpense, id, 'Bill not found');
  const billFile = files?.bill?.[0];
  const slipFile = files?.slip?.[0];

  if (billCode !== undefined && !String(billCode).trim()) throw new ApiError(400, 'billCode cannot be empty');
  if (billMonth !== undefined && billMonth !== '' && !BILL_MONTH_PATTERN.test(billMonth)) {
    throw new ApiError(400, 'billMonth must look like 2026-08');
  }
  if (expense.status === 'paid') {
    if (referenceNo !== undefined && !String(referenceNo).trim()) {
      throw new ApiError(400, 'referenceNo cannot be empty for a paid bill');
    }
    if (amount !== undefined && amount !== '' && !(Number(amount) > 0)) {
      throw new ApiError(400, 'amount must be greater than 0');
    }
  }

  if (billCode !== undefined && billCode !== '') expense.billCode = String(billCode).trim();
  if (billMonth) expense.billMonth = billMonth;
  if (billDate) expense.billDate = billDate;
  if (description !== undefined) expense.description = String(description).trim();
  if (billFile) {
    expense.billFileUrl = billFile.path;
    expense.billFileName = billFile.originalname;
  }

  if (expense.status === 'paid') {
    if (slipFile) {
      expense.slipUrl = slipFile.path;
      expense.slipFileName = slipFile.originalname;
    }
    if (bankName !== undefined) expense.bankName = bankName;
    if (accountNumber !== undefined) expense.accountNumber = accountNumber;
    if (referenceNo !== undefined) expense.referenceNo = referenceNo;
    if (date) expense.date = date;
    if (amount !== undefined && amount !== '') expense.amount = validateAmount(amount);
  }

  await expense.save({ validateModifiedOnly: true });

  return { message: 'Bill updated successfully', expense };
};

// Splits a stored Cloudinary URL such as
//   https://res.cloudinary.com/<cloud>/image/upload/v123/campus-expenses/bank-slips/abc.pdf
// into the pieces Cloudinary's signed download API needs.
const parseCloudinaryUrl = (url) => {
  const match = /\/(image|video|raw)\/(upload|authenticated|private)\/(?:v\d+\/)?([^?#]+)/.exec(url || '');
  if (!match) return null;

  const [, resourceType, type, rawPath] = match;
  const path = decodeURIComponent(rawPath);

  // Images/videos store the public_id WITHOUT its extension; raw files keep it.
  if (resourceType === 'raw') return { resourceType, type, publicId: path, format: '' };
  const dot = path.lastIndexOf('.');
  if (dot === -1) return { resourceType, type, publicId: path, format: '' };
  return { resourceType, type, publicId: path.slice(0, dot), format: path.slice(dot + 1) };
};

// Resolves everything needed to stream a bill/slip file back to the
// browser: fetches the bytes from storage (trying a signed Cloudinary
// download URL first, then the plain stored URL) and works out a sensible
// download file name. Returns the raw fetch Response so the controller can
// pipe its body and copy its headers - streaming the response itself stays
// a controller/HTTP concern.
//
// Why this exists: linking straight to Cloudinary (even with fl_attachment)
// fails whenever the Cloudinary account blocks PDF delivery, has "strict
// transformations" switched on, or the file is stored as a raw asset - the
// browser just shows an error page instead of downloading. Going through
// the backend avoids all of that: it asks Cloudinary for a signed download
// link (signed with the API secret, so those restrictions don't apply),
// falls back to the plain URL, and pipes the bytes to the client.
const resolveDownload = async (id, isSlip) => {
  const expense = await findOrFail(OfficeExpense, id, 'Bill not found');
  const fileUrl = isSlip ? expense.slipUrl : expense.billFileUrl;
  const storedName = isSlip ? expense.slipFileName : expense.billFileName;
  if (!fileUrl) {
    throw new ApiError(404, isSlip ? 'No bank slip was uploaded for this record' : 'No bill file was uploaded for this record');
  }

  const candidates = [];
  const parsed = parseCloudinaryUrl(fileUrl);
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
      console.error('Could not build signed Cloudinary download URL:', err.message);
    }
  }
  candidates.push(fileUrl);

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
      console.error(`Bill download: storage returned ${response.status} for ${url.split('?')[0]}`);
    } catch (err) {
      console.error('Bill download: could not reach storage:', err.message);
    }
  }
  if (!upstream) {
    throw new ApiError(
      502,
      `Could not fetch the file from storage${lastStatus ? ` (status ${lastStatus})` : ''}. Please try again or re-upload the file.`
    );
  }

  // Pick a download file name that always has an extension.
  const urlExt = (fileUrl.split('?')[0].match(/\.([A-Za-z0-9]{2,5})$/) || [])[1];
  let fileName = (storedName || '').trim() || `${expense.billCode || 'bill'}${isSlip ? '-slip' : ''}`;
  if (!/\.[A-Za-z0-9]{2,5}$/.test(fileName) && urlExt) fileName += `.${urlExt}`;

  return { upstream, fileName };
};

const deleteExpense = async (id) => {
  const expense = await OfficeExpense.findByIdAndDelete(id);
  if (!expense) throw new ApiError(404, 'Bill not found');
  return { message: 'Bill deleted successfully' };
};

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
  resolveDownload,
  deleteExpense,
};