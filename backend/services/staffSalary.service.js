const mongoose = require('mongoose');
const StaffLocation = require('../models/staffLocation.model');
const StaffMember = require('../models/staffMember.model');
const StaffSalary = require('../models/staffSalary.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { requireString, optionalString, validateAmount } = require('../utils/validators');
const { exactRegex } = require('../utils/escapeRegex');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const NIC_PATTERN = /^(\d{9}[VX]|\d{12})$/;
const MOBILE_PATTERN = /^0\d{9}$/;
// Letters of any language, spaces, dots (initials), hyphens, apostrophes. \p{M} (combining marks) and
// ‍ (joiner) are needed for Sinhala / Tamil names - their vowel signs and conjuncts are not "letters".
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}‍ .'-]*$/u;
// Safety limit so one request cannot store hundreds of lines.
const MAX_LINES = 30;

const round2 = (n) => Math.round(n * 100) / 100;

// An id that comes from a request body / query string must be a plain string -
// an object like {"$ne": null} would otherwise reach the database query.
const idOf = (value, field) => {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${field} is required`);
  }
  return value;
};

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

// Every location with how many staff members it has.
const getLocations = async () => {
  const [locations, counts] = await Promise.all([
    StaffLocation.find().sort({ name: 1 }).lean(),
    StaffMember.aggregate([{ $group: { _id: '$location', count: { $sum: 1 } } }]),
  ]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.count]));
  return locations.map((l) => ({ ...l, staffCount: countOf.get(String(l._id)) || 0 }));
};

const addLocation = async (body = {}) => {
  const name = requireString(body.name, 'Location name', { max: 80 });

  const existing = await StaffLocation.findOne({ name: exactRegex(name) });
  if (existing) throw new ApiError(409, 'This location already exists');

  const location = await StaffLocation.create({ name });
  return { message: 'Location added successfully', location: { ...location.toObject(), staffCount: 0 } };
};

// A location that still has staff cannot be deleted - they would be left without a location.
const deleteLocation = async (locationId) => {
  const location = await findOrFail(StaffLocation, locationId, 'Location not found');

  if (await StaffMember.exists({ location: location._id })) {
    throw new ApiError(409, 'This location still has staff members. Delete or move them first.');
  }

  await location.deleteOne();
  return { message: 'Location deleted successfully' };
};

// ---------------------------------------------------------------------------
// Staff members
// ---------------------------------------------------------------------------

// 'YYYY-MM-DD' (what <input type="date"> sends) -> a Date at UTC midnight.
const parseJoinedDate = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ApiError(400, 'Date joined is required (use YYYY-MM-DD)');
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  // toISOString() round-trip catches impossible days such as 2026-02-31.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new ApiError(400, 'Date joined is not a valid date');
  }
  const year = date.getUTCFullYear();
  if (year < 1950 || year > 2100) {
    throw new ApiError(400, 'Date joined is not a valid date');
  }
  return date;
};

// Checks and cleans the 5 profile fields (used for both adding and editing).
const readStaffFields = (body = {}) => {
  const name = requireString(body.name, 'Name', { max: 100 });
  if (!NAME_PATTERN.test(name)) {
    throw new ApiError(400, 'Name can only contain letters, spaces, dots, hyphens and apostrophes');
  }

  const nic = requireString(body.nic, 'NIC', { max: 20 }).toUpperCase();
  if (!NIC_PATTERN.test(nic)) {
    throw new ApiError(400, 'NIC must be 9 digits followed by V or X, or 12 digits');
  }

  const mobile = requireString(body.mobile, 'Mobile number', { max: 20 }).replace(/[\s-]/g, '');
  if (!MOBILE_PATTERN.test(mobile)) {
    throw new ApiError(400, 'Mobile number must be 10 digits starting with 0 (e.g. 0771234567)');
  }

  return {
    name,
    nic,
    mobile,
    joinedDate: parseJoinedDate(body.joinedDate),
    basicSalary: validateAmount(body.basicSalary, 'Basic salary'),
  };
};

const assertNicFree = async (locationId, nic, exceptStaffId) => {
  const filter = { location: locationId, nic };
  if (exceptStaffId) filter._id = { $ne: exceptStaffId };
  if (await StaffMember.exists(filter)) {
    throw new ApiError(409, 'A staff member with this NIC already exists in this location');
  }
};

// All staff, or only one location's staff when ?location=<id> is given.
const getStaff = async ({ location } = {}) => {
  const filter = {};
  if (location) filter.location = idOf(location, 'location');
  return StaffMember.find(filter).sort({ name: 1 }).lean();
};

const addStaff = async (body = {}) => {
  const fields = readStaffFields(body);
  const location = await findOrFail(StaffLocation, idOf(body.locationId, 'location'), 'Location not found');
  await assertNicFree(location._id, fields.nic);

  const staff = await StaffMember.create({ ...fields, location: location._id });
  return { message: 'Staff member added successfully', staff };
};

// Editing the profile is also how the basic salary is changed. Salaries that were
// already created keep the amount they were created with.
const updateStaff = async (staffId, body = {}) => {
  const staff = await findOrFail(StaffMember, staffId, 'Staff member not found');
  const fields = readStaffFields(body);
  await assertNicFree(staff.location, fields.nic, staff._id);

  Object.assign(staff, fields);
  await staff.save();
  return { message: 'Staff member updated successfully', staff };
};

// Salaries already created for this person stay in the records (they hold their own copy of the details).
const deleteStaff = async (staffId) => {
  const staff = await findOrFail(StaffMember, staffId, 'Staff member not found');
  await staff.deleteOne();
  return { message: 'Staff member deleted successfully' };
};

// ---------------------------------------------------------------------------
// Monthly salaries
// ---------------------------------------------------------------------------

const parseMonth = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!MONTH_PATTERN.test(text)) {
    throw new ApiError(400, 'month is required (use YYYY-MM, for example 2026-10)');
  }
  return text;
};

// The allowance / deduction rows: [{ name, amount }]. `label` is 'Allowance' or 'Deduction'.
const readLines = (value, label) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, `${label}s must be a list`);
  if (value.length > MAX_LINES) {
    throw new ApiError(400, `At most ${MAX_LINES} ${label.toLowerCase()}s can be added`);
  }
  return value.map((item, i) => {
    const row = item && typeof item === 'object' ? item : {};
    return {
      name: requireString(row.name, `${label} name (row ${i + 1})`, { max: 60 }),
      amount: validateAmount(row.amount, `${label} amount (row ${i + 1})`),
    };
  });
};

const sumLines = (lines) => round2(lines.reduce((total, line) => total + line.amount, 0));

// gross = basic + allowances, net = gross - deductions
const workOutTotals = (basicSalary, allowances, deductions) => {
  const totalAllowances = sumLines(allowances);
  const totalDeductions = sumLines(deductions);
  const grossSalary = round2(basicSalary + totalAllowances);
  const netSalary = round2(grossSalary - totalDeductions);
  if (netSalary < 0) {
    throw new ApiError(400, 'The deductions are more than the gross salary (basic salary + allowances)');
  }
  return { totalAllowances, totalDeductions, grossSalary, netSalary };
};

// GET ?month=2026-10 (required)  &location=<id> (optional)
const getSalaries = async ({ month, location } = {}) => {
  const filter = { month: parseMonth(month) };
  if (location) filter.location = idOf(location, 'location');
  return StaffSalary.find(filter).sort({ locationName: 1, staffName: 1 }).lean();
};

// The BASIC SALARY always comes from the staff profile (never from the request), so the form
// cannot be used to change it - the profile is the one place it is edited.
const createSalary = async (body = {}, userId) => {
  const month = parseMonth(body.month);
  const staff = await findOrFail(StaffMember, idOf(body.staffId, 'staffId'), 'Staff member not found');
  const location = await findOrFail(StaffLocation, staff.location, 'Location not found');

  const allowances = readLines(body.allowances, 'Allowance');
  const deductions = readLines(body.deductions, 'Deduction');
  const note = optionalString(body.note, 'Note', { max: 300 });
  const totals = workOutTotals(staff.basicSalary, allowances, deductions);

  if (await StaffSalary.exists({ staff: staff._id, month })) {
    throw new ApiError(409, `A salary for ${staff.name} in ${month} already exists. Edit it from the list instead.`);
  }

  const salary = await StaffSalary.create({
    month,
    location: location._id,
    locationName: location.name,
    staff: staff._id,
    staffName: staff.name,
    nic: staff.nic,
    basicSalary: staff.basicSalary,
    allowances,
    deductions,
    ...totals,
    note,
    createdBy: userId,
  });

  return { message: `Salary saved for ${staff.name}`, salary };
};

// Only the allowances, deductions and note can be edited. The basic salary stays as it was
// when the salary was created (delete + create again to pick up a new basic salary).
const updateSalary = async (salaryId, body = {}) => {
  const salary = await findOrFail(StaffSalary, salaryId, 'Salary record not found');

  const allowances = readLines(body.allowances, 'Allowance');
  const deductions = readLines(body.deductions, 'Deduction');
  const note = optionalString(body.note, 'Note', { max: 300 });
  const totals = workOutTotals(salary.basicSalary, allowances, deductions);

  salary.allowances = allowances;
  salary.deductions = deductions;
  salary.note = note;
  Object.assign(salary, totals);
  await salary.save();

  return { message: `Salary updated for ${salary.staffName}`, salary };
};

const deleteSalary = async (salaryId) => {
  const salary = await findOrFail(StaffSalary, salaryId, 'Salary record not found');
  await salary.deleteOne();
  return { message: 'Salary deleted successfully' };
};

module.exports = {
  getLocations,
  addLocation,
  deleteLocation,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
};