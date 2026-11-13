const mongoose = require('mongoose');
const StaffLocation = require('../models/staffLocation.model');
const StaffMember = require('../models/staffMember.model');
const StaffSalary = require('../models/staffSalary.model');
const AllowanceType = require('../models/allowanceType.model');
const DeductionType = require('../models/deductiontype.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { requireString, optionalString, validateAmount } = require('../utils/validators');
const { exactRegex } = require('../utils/escapeRegex');
const attendanceService = require('./attendance.service');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const NIC_PATTERN = /^(\d{9}[VX]|\d{12})$/;
const MOBILE_PATTERN = /^0\d{9}$/;
const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;
// Letters of any language, spaces, dots (initials), hyphens, apostrophes. \p{M} (combining marks) and
// ‍ (joiner) are needed for Sinhala / Tamil names - their vowel signs and conjuncts are not "letters".
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}‍ .'-]*$/u;

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

// Checks and cleans the 6 profile fields (used for both adding and editing).
const readStaffFields = (body = {}) => {
  const employeeNo = requireString(body.employeeNo, 'Employee number', { max: 20 }).toUpperCase();
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) {
    throw new ApiError(400, 'Employee number can only have letters, numbers, - _ and /');
  }

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
    employeeNo,
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

// The employee number is unique across ALL locations.
const assertEmployeeNoFree = async (employeeNo, exceptStaffId) => {
  const filter = { employeeNo };
  if (exceptStaffId) filter._id = { $ne: exceptStaffId };
  if (await StaffMember.exists(filter)) {
    throw new ApiError(409, `Employee number ${employeeNo} is already used by another staff member`);
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
  await assertEmployeeNoFree(fields.employeeNo);

  const staff = await StaffMember.create({ ...fields, location: location._id });
  return { message: 'Staff member added successfully', staff };
};

// Editing the profile is also how the basic salary is changed. Salaries that were
// already created keep the amount they were created with.
const updateStaff = async (staffId, body = {}) => {
  const staff = await findOrFail(StaffMember, staffId, 'Staff member not found');
  const fields = readStaffFields(body);
  await assertNicFree(staff.location, fields.nic, staff._id);
  await assertEmployeeNoFree(fields.employeeNo, staff._id);

  Object.assign(staff, fields);
  await staff.save();
  return { message: 'Staff member updated successfully', staff };
};

// Salaries already created for this person stay in the records (they hold their own copy of the details).
// The attendance of this person (and his / her place on the attendance sheet) is deleted.
const deleteStaff = async (staffId) => {
  const staff = await findOrFail(StaffMember, staffId, 'Staff member not found');
  await staff.deleteOne();
  await attendanceService.forgetStaff(staff._id);
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

// ---------------------------------------------------------------------------
// Allowance types (one shared list for every employee)
// ---------------------------------------------------------------------------
// Every monthly salary shows EVERY allowance type for the selected employee. The accountant
// picks Yes / No for each one ("No" is saved as 0), so a type added here shows up for every
// employee automatically.

// Created the first time the list is needed (in this order).
const DEFAULT_ALLOWANCE_TYPES = ['Skill Allowance', 'Performance', 'ATT', 'Extra Payments', 'Transport', 'Holiday Payments'];
const MAX_ALLOWANCE_TYPES = 40;

const ensureDefaultAllowanceTypes = async () => {
  if (await AllowanceType.exists({})) return;
  for (const name of DEFAULT_ALLOWANCE_TYPES) {
    try {
      await AllowanceType.create({ name });
    } catch (err) {
      if (err.code !== 11000) throw err; // another request created it a moment ago - fine
    }
  }
};

// In the order they were created.
const getAllowanceTypes = async () => {
  await ensureDefaultAllowanceTypes();
  return AllowanceType.find().sort({ _id: 1 }).lean();
};

const addAllowanceType = async (body = {}) => {
  const name = requireString(body.name, 'Allowance name', { max: 60 });
  await ensureDefaultAllowanceTypes(); // so the six defaults are never skipped by adding a custom one first

  if (await AllowanceType.exists({ name: exactRegex(name) })) {
    throw new ApiError(409, 'This allowance already exists');
  }
  if ((await AllowanceType.countDocuments()) >= MAX_ALLOWANCE_TYPES) {
    throw new ApiError(400, `At most ${MAX_ALLOWANCE_TYPES} allowance types can be added`);
  }

  const allowanceType = await AllowanceType.create({ name });
  return { message: `${name} added for every employee`, allowanceType };
};

// An allowance amount: 0 is allowed (it means "not added to this employee"), negatives are not.
const readAllowanceAmount = (value, field) => {
  const blank = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  if (blank) throw new ApiError(400, `${field} is required (enter 0 if it does not apply)`);

  const zero = typeof value === 'number' ? value === 0 : typeof value === 'string' && /^0+(\.0+)?$/.test(value.trim());
  if (zero) return 0;
  const negative = typeof value === 'number' ? value < 0 : typeof value === 'string' && value.trim().startsWith('-');
  if (negative) throw new ApiError(400, `${field} cannot be negative`);
  return validateAmount(value, field);
};

// Holiday Payments and No-Pay Leave are not typed in as an amount: they are worked out from days.
// Every "days" line is made of PARTS, and each part has FULL days, HALF days and its own day salary:
//     part amount = (full days + half days x 0.5) x day salary
//   Holiday Payments -> two parts: Normal holiday + Poya. The Holiday Payments amount is the TOTAL of both
//                       (so EPF / ETF see one Holiday Payments amount - see epfBaseOf below).
//   No-Pay Leave (and any other "days" deduction) -> one part.
// (The day salary of every part is typed in by the accountant - it is not taken from the basic salary.)
const HOLIDAY_ALLOWANCE = 'Holiday Payments';
const MAX_HOLIDAY_DAYS = 31; // in total for the line (full days + half days x 0.5, all parts together)

const HOLIDAY_PARTS = [
  { key: 'normal', label: 'Normal holiday' },
  { key: 'poya', label: 'Poya' },
];
const SINGLE_PART = [{ key: 'main', label: '' }];
const partsOf = (name) => (name === HOLIDAY_ALLOWANCE ? HOLIDAY_PARTS : SINGLE_PART);

// A number of full days or half days: a whole number, 0 or more. Blank = 0.
const readCount = (value, field) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return 0;
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isInteger(number) || number < 0) throw new ApiError(400, `${field} must be a whole number (0 or more)`);
  if (number > MAX_HOLIDAY_DAYS * 2) throw new ApiError(400, `${field} is too large`);
  return number;
};

// Row from the form: { name, parts: [{ key, fullDays, halfDays, daySalary }] }.
// The amount sent by the client is never used. No days at all = "not added" (only an amount of 0 is accepted then).
const readDaysLine = (row, label, name = label) => {
  if (row.parts !== undefined && row.parts !== null && !Array.isArray(row.parts)) {
    throw new ApiError(400, `${label}: parts must be a list`);
  }
  const defs = partsOf(name);

  const given = new Map();
  (row.parts || []).forEach((item) => {
    const part = item && typeof item === 'object' ? item : {};
    if (!defs.some((d) => d.key === part.key)) throw new ApiError(400, `${label}: unknown part "${part.key}"`);
    if (given.has(part.key)) throw new ApiError(400, `${label}: "${part.key}" is listed twice`);
    given.set(part.key, part);
  });

  const parts = [];
  let totalDays = 0;
  defs.forEach((def) => {
    const part = given.get(def.key);
    if (!part) return;
    const what = def.label ? `${label} (${def.label})` : label;
    const fullDays = readCount(part.fullDays, `${what} full days`);
    const halfDays = readCount(part.halfDays, `${what} half days`);
    const days = fullDays + halfDays * 0.5;
    if (days === 0) return; // nothing entered for this part
    const daySalary = validateAmount(part.daySalary, `${what} day salary`);
    totalDays += days;
    parts.push({ key: def.key, label: def.label, fullDays, halfDays, daySalary, amount: round2(days * daySalary) });
  });

  if (parts.length === 0) {
    if (readAllowanceAmount(row.amount, `${label} amount`) !== 0) {
      throw new ApiError(400, `${label} needs the days (full or half) and the day salary`);
    }
    return { amount: 0 };
  }
  if (totalDays > MAX_HOLIDAY_DAYS) throw new ApiError(400, `${label} days cannot be more than ${MAX_HOLIDAY_DAYS} in total`);

  return { amount: round2(parts.reduce((total, part) => total + part.amount, 0)), days: totalDays, parts };
};

const readHolidayLine = (row) => readDaysLine(row, 'Holiday', HOLIDAY_ALLOWANCE);

// Allowance rows from the form: [{ name, amount }]. Names must be in the allowance list.
// `keepNames` are names already stored on the record being edited (they stay editable even
// if they are not in the list, e.g. a free-text allowance saved by an earlier version).
// The result has ONE line for every allowance, in list order; any that were not sent are 0.
const readAllowances = (value, typeNames, keepNames = []) => {
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    throw new ApiError(400, 'Allowances must be a list');
  }
  const allowedNames = [...typeNames, ...keepNames.filter((n) => !typeNames.includes(n))];

  const given = new Map();
  (value || []).forEach((item, i) => {
    const row = item && typeof item === 'object' ? item : {};
    const name = requireString(row.name, `Allowance name (row ${i + 1})`, { max: 60 });
    if (!allowedNames.includes(name)) {
      throw new ApiError(400, `"${name}" is not in the allowance list. Add it as a new allowance first.`);
    }
    if (given.has(name)) throw new ApiError(400, `"${name}" is listed twice`);
    given.set(name, name === HOLIDAY_ALLOWANCE ? readHolidayLine(row) : { amount: readAllowanceAmount(row.amount, `${name} amount`) });
  });

  return allowedNames.map((name) => ({ name, ...(given.get(name) || { amount: 0 }) }));
};

// ---------------------------------------------------------------------------
// Deduction types (one shared list for every employee)
// ---------------------------------------------------------------------------
// Same idea as the allowances: every monthly salary shows EVERY deduction type, Yes / No for each
// ("No" is saved as 0), and a type added here shows up for every employee.
//   EPF 8% / ETF 3%  -> worked out from the BASIC salary. If this month has a Holiday Payments
//                       amount (Normal holiday + Poya together), that amount is added to the basic
//                       salary first (basic + holiday payments). No holiday payment that month = basic salary only.
//                       Other allowances (Transport, ATT ...) are never included.
//   No-Pay Leave     -> (full days + half days x 0.5) x day salary
//   Advances, Loans  -> typed in
// The total of all deductions is taken off the gross salary (basic + allowances) to give the net salary.

const DEFAULT_DEDUCTION_TYPES = [
  { name: 'EPF', kind: 'percent', rate: 8 },
  { name: 'ETF', kind: 'percent', rate: 3 },
  { name: 'No-Pay Leave', kind: 'days' },
  { name: 'Advances', kind: 'amount' },
  { name: 'Loans', kind: 'amount' },
];
const MAX_DEDUCTION_TYPES = 40;

const ensureDefaultDeductionTypes = async () => {
  if (await DeductionType.exists({})) return;
  for (const type of DEFAULT_DEDUCTION_TYPES) {
    try {
      await DeductionType.create(type);
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
};

const getDeductionTypes = async () => {
  await ensureDefaultDeductionTypes();
  return DeductionType.find().sort({ _id: 1 }).lean();
};

// New deduction types are always "typed in" amounts (like Advances / Loans).
const addDeductionType = async (body = {}) => {
  const name = requireString(body.name, 'Deduction name', { max: 60 });
  await ensureDefaultDeductionTypes();

  if (await DeductionType.exists({ name: exactRegex(name) })) {
    throw new ApiError(409, 'This deduction already exists');
  }
  if ((await DeductionType.countDocuments()) >= MAX_DEDUCTION_TYPES) {
    throw new ApiError(400, `At most ${MAX_DEDUCTION_TYPES} deduction types can be added`);
  }

  const deductionType = await DeductionType.create({ name, kind: 'amount' });
  return { message: `${name} added for every employee`, deductionType };
};

// Deduction rows from the form. `types` = the deduction list; `keepNames` = names already stored on
// the record being edited that are not in the list (e.g. free-text rows from an earlier version).
// Row shapes:  percent -> { name, apply: true|false }   days -> { name, parts: [{ key, fullDays, halfDays, daySalary }] }   amount -> { name, amount }
// The result has ONE line per deduction type, in list order; any that were not sent are 0.
const readDeductions = (value, types, percentBase, keepNames = []) => {
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    throw new ApiError(400, 'Deductions must be a list');
  }
  const all = [
    ...types,
    ...keepNames.filter((n) => !types.some((t) => t.name === n)).map((name) => ({ name, kind: 'amount' })),
  ];

  const given = new Map();
  (value || []).forEach((item, i) => {
    const row = item && typeof item === 'object' ? item : {};
    const name = requireString(row.name, `Deduction name (row ${i + 1})`, { max: 60 });
    const type = all.find((t) => t.name === name);
    if (!type) throw new ApiError(400, `"${name}" is not in the deduction list. Add it as a new deduction first.`);
    if (given.has(name)) throw new ApiError(400, `"${name}" is listed twice`);

    if (type.kind === 'percent') {
      if (row.apply !== undefined && typeof row.apply !== 'boolean') {
        throw new ApiError(400, `${name}: apply must be true or false`);
      }
      // The rate always comes from the deduction list - the client cannot choose it.
      // percentBase = basic salary (+ this month's Holiday Payments, if any) - see epfBaseOf().
      given.set(name, row.apply ? { amount: round2((percentBase * type.rate) / 100), rate: type.rate, base: percentBase } : { amount: 0 });
    } else if (type.kind === 'days') {
      given.set(name, readDaysLine(row, name));
    } else {
      given.set(name, { amount: readAllowanceAmount(row.amount, `${name} amount`) });
    }
  });

  return all.map((t) => ({ name: t.name, ...(given.get(t.name) || { amount: 0 }) }));
};

// The amount EPF / ETF are worked out from:
//   month WITH a Holiday Payments amount  -> basic salary + Holiday Payments
//   month WITHOUT one                     -> basic salary only
// (only Holiday Payments is added - Transport, ATT, Performance ... are not part of the base)
const epfBaseOf = (basicSalary, allowances) => {
  const holiday = allowances.find((line) => line.name === HOLIDAY_ALLOWANCE);
  return round2(basicSalary + (holiday ? holiday.amount : 0));
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

  const typeNames = (await getAllowanceTypes()).map((t) => t.name);
  const allowances = readAllowances(body.allowances, typeNames);
  const deductions = readDeductions(body.deductions, await getDeductionTypes(), epfBaseOf(staff.basicSalary, allowances));
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
    employeeNo: staff.employeeNo,
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

  // Salaries created before the employee number existed pick it up from the profile the first time they are edited.
  if (!salary.employeeNo) {
    const profile = await StaffMember.findById(salary.staff).select('employeeNo').lean();
    if (profile && profile.employeeNo) salary.employeeNo = profile.employeeNo;
  }

  const typeNames = (await getAllowanceTypes()).map((t) => t.name);
  const allowances = readAllowances(body.allowances, typeNames, salary.allowances.map((l) => l.name));
  const deductions = readDeductions(body.deductions, await getDeductionTypes(), epfBaseOf(salary.basicSalary, allowances), salary.deductions.map((l) => l.name));
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
  getAllowanceTypes,
  addAllowanceType,
  getDeductionTypes,
  addDeductionType,
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