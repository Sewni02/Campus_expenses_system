const mongoose = require('mongoose');
const AttendanceEmployee = require('../models/attendanceEmployee.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceMonth = require('../models/attendanceMonth.model');
const AttendanceSetting = require('../models/attendanceSetting.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { requireString } = require('../utils/validators');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;
// Letters of any language, spaces, dots (initials), hyphens, apostrophes (\p{M} / joiner for Sinhala / Tamil names).
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}‍ .'-]*$/u;

const round2 = (n) => Math.round(n * 100) / 100;

// An id from a request body must be a plain string (an object like {"$ne": null} must never reach a query).
const idOf = (value, field) => {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${field} is required`);
  }
  return value;
};

const parseMonth = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!MONTH_PATTERN.test(text)) {
    throw new ApiError(400, 'month is required (use YYYY-MM, for example 2026-11)');
  }
  return text;
};

// 28 - 31, leap years included.
const daysInMonth = (month) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
};

// A number sent as a number or as a plain numeric string ("1.5"). Anything else is rejected.
const readNumber = (value, field) => {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isFinite(number)) throw new ApiError(400, `${field} must be a number`);
  return number;
};
const hasAtMost2Decimals = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// ---------------------------------------------------------------------------
// Employees (the permanent list shown on every month's sheet)
// ---------------------------------------------------------------------------

const readEmployeeFields = (body = {}) => {
  const employeeNo = requireString(body.employeeNo, 'Employee number', { max: 20 }).toUpperCase();
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) {
    throw new ApiError(400, 'Employee number can only have letters, numbers, - _ and /');
  }
  const name = requireString(body.name, 'Name', { max: 100 });
  if (!NAME_PATTERN.test(name)) throw new ApiError(400, 'Name can only have letters, spaces, dots, hyphens and apostrophes');
  return { employeeNo, name };
};

const assertNumberFree = async (employeeNo, exceptId) => {
  const filter = { employeeNo };
  if (exceptId) filter._id = { $ne: exceptId };
  if (await AttendanceEmployee.exists(filter)) {
    throw new ApiError(400, `Employee number ${employeeNo} is already used`);
  }
};

const getEmployees = async () => AttendanceEmployee.find().sort({ employeeNo: 1 });

const addEmployee = async (body = {}) => {
  const fields = readEmployeeFields(body);
  await assertNumberFree(fields.employeeNo);
  try {
    const employee = await AttendanceEmployee.create(fields);
    return { message: 'Employee added successfully', employee };
  } catch (err) {
    if (err.code === 11000) throw new ApiError(400, `Employee number ${fields.employeeNo} is already used`);
    throw err;
  }
};

const updateEmployee = async (employeeId, body = {}) => {
  const employee = await findOrFail(AttendanceEmployee, employeeId, 'Employee not found');
  const fields = readEmployeeFields(body);
  await assertNumberFree(fields.employeeNo, employee._id);
  Object.assign(employee, fields);
  try {
    await employee.save();
  } catch (err) {
    if (err.code === 11000) throw new ApiError(400, `Employee number ${fields.employeeNo} is already used`);
    throw err;
  }
  return { message: 'Employee updated successfully', employee };
};

// Deleting an employee also deletes his / her attendance of every month.
const deleteEmployee = async (employeeId) => {
  const employee = await findOrFail(AttendanceEmployee, employeeId, 'Employee not found');
  await AttendanceRecord.deleteMany({ employee: employee._id });
  await employee.deleteOne();
  return { message: 'Employee deleted successfully' };
};

// ---------------------------------------------------------------------------
// Arrival allowance ranges
//   Every range = "from minPercent % and above -> amount". The highest range reached applies;
//   below the lowest range there is no allowance. Highest range first in every list returned.
// ---------------------------------------------------------------------------

const SETTING_KEY = 'allowance';
const MAX_RANGES = 10;
const MAX_ALLOWANCE = 10000000;
const DEFAULT_RANGES = [
  { minPercent: 90, amount: 5000 }, // 90% - 100%
  { minPercent: 80, amount: 4000 }, // 80% - below 90%
  { minPercent: 70, amount: 2000 }, // 70% - below 80%
];

const plainRanges = (tiers) =>
  tiers.map((t) => ({ minPercent: t.minPercent, amount: t.amount })).sort((a, b) => b.minPercent - a.minPercent);

// The ranges; the 3 default ones are created the first time they are needed.
const getRanges = async () => {
  let setting = await AttendanceSetting.findOne({ key: SETTING_KEY });
  if (!setting) {
    try {
      setting = await AttendanceSetting.create({ key: SETTING_KEY, tiers: DEFAULT_RANGES });
    } catch (err) {
      if (err.code !== 11000) throw err; // another request created them a moment ago - fine
      setting = await AttendanceSetting.findOne({ key: SETTING_KEY });
    }
  }
  return plainRanges(setting.tiers);
};

const readRanges = (value) => {
  if (!Array.isArray(value)) throw new ApiError(400, 'ranges must be a list');
  if (value.length > MAX_RANGES) throw new ApiError(400, `At most ${MAX_RANGES} ranges are allowed`);

  const seen = new Set();
  const ranges = value.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    const label = `Range ${index + 1}`;
    const minPercent = readNumber(item.minPercent, `${label}: from %`);
    if (minPercent <= 0 || minPercent > 100 || !hasAtMost2Decimals(minPercent)) {
      throw new ApiError(400, `${label}: "from %" must be more than 0 and at most 100 (up to 2 decimals)`);
    }
    const amount = readNumber(item.amount, `${label}: amount`);
    if (amount > MAX_ALLOWANCE || !hasAtMost2Decimals(amount)) {
      throw new ApiError(400, `${label}: amount must be 0 or more (up to 2 decimals, at most ${MAX_ALLOWANCE})`);
    }
    if (seen.has(minPercent)) throw new ApiError(400, `${label}: another range already starts at ${minPercent}%`);
    seen.add(minPercent);
    return { minPercent: round2(minPercent), amount: round2(amount) };
  });
  return plainRanges(ranges);
};

const setRanges = async (body = {}) => {
  const ranges = readRanges(body.ranges);
  const save = () =>
    AttendanceSetting.findOneAndUpdate({ key: SETTING_KEY }, { $set: { tiers: ranges } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    await save();
  } catch (err) {
    if (err.code !== 11000) throw err;
    await save(); // two first-time saves at once - the second one now only updates
  }
  return { message: 'Allowance ranges saved successfully', ranges };
};

// arrival percentage = arrival days / total days x 100  (can pass 100 when extra work days are counted)
const percentOf = (arrivalDays, totalDays) => (totalDays > 0 ? (arrivalDays * 100) / totalDays : 0);
// ranges are highest first, so the first one that is reached is the one that applies
const allowanceFor = (percent, ranges) => {
  const range = ranges.find((r) => percent + 1e-9 >= r.minPercent);
  return range ? range.amount : 0;
};

// ---------------------------------------------------------------------------
// Monthly sheet
// ---------------------------------------------------------------------------

// A list of days of the month: whole numbers 1..daysInMonth, no duplicates.
const readDates = (value, field, maxDay) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, `${field} must be a list of days`);
  const seen = new Set();
  value.forEach((item) => {
    if (!Number.isInteger(item) || item < 1 || item > maxDay) {
      throw new ApiError(400, `${field}: each day must be a whole number from 1 to ${maxDay}`);
    }
    if (seen.has(item)) throw new ApiError(400, `${field}: day ${item} is listed twice`);
    seen.add(item);
  });
  return [...seen].sort((a, b) => a - b);
};

// Leave days: whole or half days (0, 0.5, 1, 1.5 ... 31).
// undefined = not sent (the saved value stays), blank / null = 0.
const readLeave = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === 'string' && value.trim() === '')) return 0;
  const number = readNumber(value, field);
  if (number > 31 || !Number.isInteger(number * 2)) {
    throw new ApiError(400, `${field} must be whole or half days (0, 0.5, 1, 1.5 ... up to 31)`);
  }
  return number;
};

// The total days of a month: whole number 1..31. undefined = not sent, null = back to the calendar days.
const readTotalDays = (value) => {
  if (value === undefined || value === null) return value;
  const number = readNumber(value, 'Total days');
  if (!Number.isInteger(number) || number < 1 || number > 31) {
    throw new ApiError(400, 'Total days must be a whole number from 1 to 31');
  }
  return number;
};

const sheetRow = (employee, record, totalDays, ranges) => {
  const normalDates = record ? record.normalDates : [];
  const extraDates = record ? record.extraDates : [];
  const arrivalDays = normalDates.length + extraDates.length;
  const percent = percentOf(arrivalDays, totalDays);
  return {
    _id: employee._id,
    employeeNo: employee.employeeNo,
    name: employee.name,
    normalDates,
    extraDates,
    normalDays: normalDates.length,
    extraDays: extraDates.length,
    arrivalDays,
    medicalLeave: (record && record.medicalLeave) || 0,
    casualLeave: (record && record.casualLeave) || 0,
    noPayDays: (record && record.noPayDays) || 0,
    arrivalPercentage: round2(percent),
    allowance: allowanceFor(percent, ranges),
  };
};

// GET ?month=2026-11 -> every employee of the list with his / her attendance of that month
// (employees with nothing marked yet come back with empty lists and 0 days), the total days of the month
// (the calendar days unless it was changed) and the allowance ranges.
const getSheet = async (query = {}) => {
  const month = parseMonth(query.month);
  const [employees, records, monthSetting, ranges] = await Promise.all([
    getEmployees(),
    AttendanceRecord.find({ month }),
    AttendanceMonth.findOne({ month }),
    getRanges(),
  ]);
  const byEmployee = new Map(records.map((r) => [String(r.employee), r]));
  const calendarDays = daysInMonth(month);
  const totalDays = monthSetting ? monthSetting.totalDays : calendarDays;
  return {
    month,
    daysInMonth: calendarDays,
    totalDays,
    totalDaysChanged: Boolean(monthSetting),
    ranges,
    employees: employees.map((e) => sheetRow(e, byEmployee.get(String(e._id)), totalDays, ranges)),
  };
};

// PUT { month, totalDays?, rows?: [{ employeeId, normalDates, extraDates, medicalLeave, casualLeave, noPayDays }] }
// Saves the rows sent (one record per employee per month) and / or the total days of the month.
// The counts are worked out here; the percentage and the allowance are worked out when the sheet is read.
const saveSheet = async (body = {}) => {
  const month = parseMonth(body.month);
  const maxDay = daysInMonth(month);
  const totalDays = readTotalDays(body.totalDays);

  const rawRows = body.rows === undefined ? [] : body.rows;
  if (!Array.isArray(rawRows)) throw new ApiError(400, 'rows must be a list');
  if (rawRows.length === 0 && totalDays === undefined) throw new ApiError(400, 'There is nothing to save');
  if (rawRows.length > 1000) throw new ApiError(400, 'Too many rows');

  const seen = new Set();
  const rows = rawRows.map((raw) => {
    const row = raw && typeof raw === 'object' ? raw : {};
    const employeeId = idOf(row.employeeId, 'employeeId');
    if (seen.has(employeeId)) throw new ApiError(400, 'An employee is listed twice');
    seen.add(employeeId);

    const normalDates = readDates(row.normalDates, 'Normal days', maxDay);
    const extraDates = readDates(row.extraDates, 'Extra days', maxDay);
    const both = normalDates.find((d) => extraDates.includes(d));
    if (both) throw new ApiError(400, `Day ${both} cannot be both a normal day and an extra day`);

    return {
      employeeId,
      normalDates,
      extraDates,
      medicalLeave: readLeave(row.medicalLeave, 'Medical leave'),
      casualLeave: readLeave(row.casualLeave, 'Casual leave'),
      noPayDays: readLeave(row.noPayDays, 'No-pay days'),
    };
  });

  if (rows.length > 0) {
    const count = await AttendanceEmployee.countDocuments({ _id: { $in: rows.map((r) => r.employeeId) } });
    if (count !== rows.length) throw new ApiError(404, 'An employee was not found (it may have been deleted) - reload the sheet');

    await AttendanceRecord.bulkWrite(
      rows.map((r) => {
        const set = {
          normalDates: r.normalDates,
          extraDates: r.extraDates,
          normalDays: r.normalDates.length,
          extraDays: r.extraDates.length,
          arrivalDays: r.normalDates.length + r.extraDates.length,
        };
        if (r.medicalLeave !== undefined) set.medicalLeave = r.medicalLeave;
        if (r.casualLeave !== undefined) set.casualLeave = r.casualLeave;
        if (r.noPayDays !== undefined) set.noPayDays = r.noPayDays;
        return { updateOne: { filter: { month, employee: r.employeeId }, update: { $set: set }, upsert: true } };
      })
    );
  }

  if (totalDays !== undefined) {
    if (totalDays === null || totalDays === maxDay) {
      await AttendanceMonth.deleteOne({ month }); // the calendar days are the default - nothing to keep
    } else {
      await AttendanceMonth.updateOne({ month }, { $set: { totalDays } }, { upsert: true });
    }
  }

  return { message: 'Attendance saved successfully', ...(await getSheet({ month })) };
};

module.exports = {
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getRanges,
  setRanges,
  getSheet,
  saveSheet,
};