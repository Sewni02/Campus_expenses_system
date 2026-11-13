const mongoose = require('mongoose');
const StaffLocation = require('../models/staffLocation.model');
const StaffMember = require('../models/staffMember.model');
const AttendanceSelection = require('../models/attendanceSelection.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceMonth = require('../models/attendanceMonth.model');
const AttendanceSetting = require('../models/attendanceSetting.model');
const { ApiError, findOrFail } = require('../utils/ApiError');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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
// Employees on the sheet
//   The employees are the STAFF MEMBERS of Staff & Locations (name + employee number). For each location the
//   accountant ticks the ones whose attendance is taken; they are then on the sheet of every month.
// ---------------------------------------------------------------------------

// E2 before E10 (numbers inside the employee number are compared as numbers).
const byEmployeeNo = (a, b) =>
  (a.employeeNo || '').localeCompare(b.employeeNo || '', undefined, { numeric: true }) || a.name.localeCompare(b.name);

// PUT { location, staffIds: [...] } -> the staff members of that location who are on its attendance sheet.
const saveSelection = async (body = {}) => {
  const location = await findOrFail(StaffLocation, idOf(body.location, 'location'), 'Location not found');
  if (!Array.isArray(body.staffIds)) throw new ApiError(400, 'staffIds must be a list');
  if (body.staffIds.length > 500) throw new ApiError(400, 'Too many employees');
  const ids = [...new Set(body.staffIds.map((id) => idOf(id, 'employee')))];

  const found = await StaffMember.find({ _id: { $in: ids }, location: location._id }).select('employeeNo name').lean();
  if (found.length !== ids.length) {
    throw new ApiError(400, 'Some of the selected employees are not in this location any more - reload the page');
  }
  const noNumber = found.find((s) => !s.employeeNo);
  if (noNumber) {
    throw new ApiError(400, `${noNumber.name} has no employee number yet - add it in Staff & Locations first`);
  }

  const save = () =>
    AttendanceSelection.findOneAndUpdate({ location: location._id }, { $set: { staff: ids } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    await save();
  } catch (err) {
    if (err.code !== 11000) throw err;
    await save(); // two first-time saves at once - the second one now only updates
  }
  return { message: 'Employees on the sheet saved successfully' };
};

// Called when a staff member is deleted: off the sheets, and his / her attendance is deleted too.
const forgetStaff = async (staffId) => {
  await AttendanceSelection.updateMany({ staff: staffId }, { $pull: { staff: staffId } });
  await AttendanceRecord.deleteMany({ employee: staffId });
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

// The numbers of the paper report. Every one is typed in as whole or half days (0, 0.5, 1, 1.5 ... 31).
const SHEET_FIELDS = [
  ['arrivedDays', 'Arrived days'],
  ['extraDays', 'Extra days'],
  ['leaveDays', 'Leave days'],
  ['medicalLeave', 'Medical leave'],
  ['casualLeave', 'Casual leave'],
  ['noPayDays', 'No-pay days'],
];

// blank / not sent = 0
const readDays = (value, field) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return 0;
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
  const value = (key) => (record && record[key]) || 0;
  const arrivalDays = value('arrivedDays') + value('extraDays'); // extra work days are arrival days too
  const percent = percentOf(arrivalDays, totalDays);
  return {
    _id: employee._id,
    employeeNo: employee.employeeNo,
    name: employee.name,
    arrivedDays: value('arrivedDays'),
    extraDays: value('extraDays'),
    arrivalDays,
    leaveDays: value('leaveDays'),
    medicalLeave: value('medicalLeave'),
    casualLeave: value('casualLeave'),
    noPayDays: value('noPayDays'),
    arrivalPercentage: round2(percent),
    allowance: allowanceFor(percent, ranges),
  };
};

// GET ?month=2026-11&location=<id> -> the employees on the sheet of that location (in the order they were added)
// with his / her numbers of that month (0 until typed in), the total days of the month (the calendar days unless
// it was changed), the allowance ranges, and `candidates` = every staff member of the location with
// `selected` (the employee numbers the accountant can add to the sheet).
const getSheet = async (query = {}) => {
  const month = parseMonth(query.month);
  const location = await findOrFail(StaffLocation, idOf(query.location, 'location'), 'Location not found');

  const [staffList, selection, monthSetting, ranges] = await Promise.all([
    StaffMember.find({ location: location._id }).select('employeeNo name').lean(),
    AttendanceSelection.findOne({ location: location._id }).lean(),
    AttendanceMonth.findOne({ month }),
    getRanges(),
  ]);
  staffList.sort(byEmployeeNo);
  const selectedIds = new Set(((selection && selection.staff) || []).map(String));
  // the sheet keeps the order the employees were added in (like the "No" column of the paper report)
  const staffById = new Map(staffList.map((s) => [String(s._id), s]));
  const onSheet = ((selection && selection.staff) || []).map((id) => staffById.get(String(id))).filter((s) => s && s.employeeNo);

  const records = onSheet.length > 0 ? await AttendanceRecord.find({ month, employee: { $in: onSheet.map((s) => s._id) } }) : [];
  const byEmployee = new Map(records.map((r) => [String(r.employee), r]));
  const calendarDays = daysInMonth(month);
  const totalDays = monthSetting ? monthSetting.totalDays : calendarDays;

  return {
    month,
    location: { _id: location._id, name: location.name },
    daysInMonth: calendarDays,
    totalDays,
    totalDaysChanged: Boolean(monthSetting),
    ranges,
    employees: onSheet.map((s) => sheetRow(s, byEmployee.get(String(s._id)), totalDays, ranges)),
    candidates: staffList.map((s) => ({
      _id: s._id,
      employeeNo: s.employeeNo || '',
      name: s.name,
      selected: Boolean(s.employeeNo) && selectedIds.has(String(s._id)),
    })),
  };
};

// PUT { month, location, totalDays?, rows?: [{ employeeId, arrivedDays, extraDays, leaveDays, medicalLeave, casualLeave, noPayDays }] }
// Saves the rows sent (one record per employee per month) and / or the total days of the month.
// The counts are worked out here; the percentage and the allowance are worked out when the sheet is read.
const saveSheet = async (body = {}) => {
  const month = parseMonth(body.month);
  const locationId = idOf(body.location, 'location');
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

    const numbers = {};
    SHEET_FIELDS.forEach(([key, label]) => {
      numbers[key] = readDays(row[key], label);
    });
    return { employeeId, ...numbers };
  });

  if (rows.length > 0) {
    // only staff members of this location can be saved on its sheet
    const count = await StaffMember.countDocuments({ _id: { $in: rows.map((r) => r.employeeId) }, location: locationId });
    if (count !== rows.length) throw new ApiError(404, 'An employee was not found in this location (it may have been deleted) - reload the sheet');

    await AttendanceRecord.bulkWrite(
      rows.map((r) => {
        const set = { arrivalDays: r.arrivedDays + r.extraDays };
        SHEET_FIELDS.forEach(([key]) => {
          set[key] = r[key];
        });
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

  return { message: 'Attendance saved successfully', ...(await getSheet({ month, location: locationId })) };
};

module.exports = {
  saveSelection,
  forgetStaff,
  getRanges,
  setRanges,
  getSheet,
  saveSheet,
};