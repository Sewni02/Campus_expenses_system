const mongoose = require('mongoose');
const StaffLocation = require('../models/staffLocation.model');
const StaffMember = require('../models/staffMember.model');
const AttendanceSelection = require('../models/attendanceSelection.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceMonth = require('../models/attendanceMonth.model');
const AttendanceSetting = require('../models/attendanceSetting.model');
const AttendanceSnapshot = require('../models/attendanceSnapshot.model');
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
// Total days (the number the arrival % is worked out with)
//   NOT the days of the calendar month. It is ONE standing number (25 until the accountant changes it) that
//   every month uses, so November, December, February ... all use the same count. When the accountant
//   types a new number and saves, it is used from then on; months that were already saved keep the total days
//   they were saved with (see attendanceSnapshot.model.js).
// ---------------------------------------------------------------------------

const TOTAL_DAYS_KEY = 'totalDays';
const DEFAULT_TOTAL_DAYS = 25;

const getStandingTotalDays = async () => {
  const setting = await AttendanceSetting.findOne({ key: TOTAL_DAYS_KEY });
  return setting && setting.totalDays ? setting.totalDays : DEFAULT_TOTAL_DAYS;
};

const setStandingTotalDays = async (days) => {
  const save = () =>
    AttendanceSetting.findOneAndUpdate({ key: TOTAL_DAYS_KEY }, { $set: { totalDays: days } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    await save();
  } catch (err) {
    if (err.code !== 11000) throw err;
    await save(); // two first-time saves at once - the second one now only updates
  }
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

// The total days: whole number 1..31. undefined = not sent, null = back to the standard 25.
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

// The same ranges? (both lists are sorted highest first)
const sameRanges = (a, b) =>
  a.length === b.length && a.every((r, i) => r.minPercent === b[i].minPercent && r.amount === b[i].amount);

// GET ?month=2026-11&location=<id> -> the employees on the sheet of that location (in the order they were added)
// with his / her numbers of that month (0 until typed in), the total days of the month (the calendar days unless
// it was changed), the allowance ranges, and `candidates` = every staff member of the location with
// `selected` (the employee numbers the accountant can add to the sheet).
//
// Allowance ranges:
//   ranges        = the ranges used for THIS month. Once the month has been saved they are frozen (the ranges
//                   that were used when it was saved), so changing the ranges later does not change old months.
//   currentRanges = the ranges as they are now (what the "Allowance ranges" editor shows and saves).
//   rangesFrozen  = this month already has a saved copy (so its ranges are frozen).
//   rangesOutdated= frozen ranges that are different from the current ranges.
const getSheet = async (query = {}) => {
  const month = parseMonth(query.month);
  const location = await findOrFail(StaffLocation, idOf(query.location, 'location'), 'Location not found');

  const [staffList, selection, monthSetting, currentRanges, snapshot, standingTotalDays] = await Promise.all([
    StaffMember.find({ location: location._id }).select('employeeNo name').lean(),
    AttendanceSelection.findOne({ location: location._id }).lean(),
    AttendanceMonth.findOne({ month }),
    getRanges(),
    AttendanceSnapshot.findOne({ month, location: location._id }).select('ranges totalDays').lean(),
    getStandingTotalDays(),
  ]);
  const ranges = snapshot ? plainRanges(snapshot.ranges) : currentRanges;
  staffList.sort(byEmployeeNo);
  const selectedIds = new Set(((selection && selection.staff) || []).map(String));
  // the sheet keeps the order the employees were added in (like the "No" column of the paper report)
  const staffById = new Map(staffList.map((s) => [String(s._id), s]));
  const onSheet = ((selection && selection.staff) || []).map((id) => staffById.get(String(id))).filter((s) => s && s.employeeNo);

  const records = onSheet.length > 0 ? await AttendanceRecord.find({ month, employee: { $in: onSheet.map((s) => s._id) } }) : [];
  const byEmployee = new Map(records.map((r) => [String(r.employee), r]));
  const calendarDays = daysInMonth(month);
  // Total days of this month:
  //   1. a month that was saved keeps the total days it was saved with,
  //   2. (a value set for one single month by an older version of the app is still respected),
  //   3. otherwise the standing total days (25 until changed) - the SAME for every month, not the calendar days.
  const totalDays = snapshot && snapshot.totalDays ? snapshot.totalDays : monthSetting ? monthSetting.totalDays : standingTotalDays;

  return {
    month,
    location: { _id: location._id, name: location.name },
    daysInMonth: calendarDays,
    totalDays,
    standingTotalDays,
    ranges,
    currentRanges,
    rangesFrozen: Boolean(snapshot),
    rangesOutdated: Boolean(snapshot) && !sameRanges(ranges, currentRanges),
    employees: onSheet.map((s) => sheetRow(s, byEmployee.get(String(s._id)), totalDays, ranges)),
    candidates: staffList.map((s) => ({
      _id: s._id,
      employeeNo: s.employeeNo || '',
      name: s.name,
      selected: Boolean(s.employeeNo) && selectedIds.has(String(s._id)),
    })),
  };
};

// ---------------------------------------------------------------------------
// Saved months (a stored copy of every month that was saved - see attendanceSnapshot.model.js)
// ---------------------------------------------------------------------------

// Stores (or replaces) the saved copy of the month shown on `sheet` (the object getSheet returns).
// A sheet with nobody on it is not stored.
const saveSnapshot = async (sheet) => {
  if (!sheet.employees.length) return;
  const data = {
    locationName: sheet.location.name,
    totalDays: sheet.totalDays,
    ranges: sheet.ranges,
    rows: sheet.employees.map((e) => ({
      employee: e._id,
      employeeNo: e.employeeNo,
      name: e.name,
      arrivedDays: e.arrivedDays,
      extraDays: e.extraDays,
      arrivalDays: e.arrivalDays,
      leaveDays: e.leaveDays,
      medicalLeave: e.medicalLeave,
      casualLeave: e.casualLeave,
      noPayDays: e.noPayDays,
      arrivalPercentage: e.arrivalPercentage,
      allowance: e.allowance,
    })),
    totalAllowance: round2(sheet.employees.reduce((t, e) => t + e.allowance, 0)),
  };
  const save = () =>
    AttendanceSnapshot.updateOne({ month: sheet.month, location: sheet.location._id }, { $set: data }, { upsert: true });
  try {
    await save();
  } catch (err) {
    if (err.code !== 11000) throw err;
    await save(); // two first-time saves at once - the second one now only updates
  }
};

// Months saved BEFORE saved copies existed (they only have the typed records): make their copy now, once,
// with the ranges as they are now. Months that already have a copy are not touched.
const backfillSnapshots = async (location) => {
  const selection = await AttendanceSelection.findOne({ location: location._id }).lean();
  const staffIds = (selection && selection.staff) || [];
  if (staffIds.length === 0) return;

  const [recordMonths, savedMonths] = await Promise.all([
    AttendanceRecord.distinct('month', { employee: { $in: staffIds } }),
    AttendanceSnapshot.distinct('month', { location: location._id }),
  ]);
  const have = new Set(savedMonths);
  const missing = recordMonths.filter((m) => !have.has(m)).sort();
  for (const month of missing) {
    // eslint-disable-next-line no-await-in-loop
    await saveSnapshot(await getSheet({ month, location: String(location._id) }));
  }
};

// GET ?location=<id> -> every saved month of that location, newest first (for the "Saved months" list).
const listSaved = async (query = {}) => {
  const location = await findOrFail(StaffLocation, idOf(query.location, 'location'), 'Location not found');
  await backfillSnapshots(location);

  const list = await AttendanceSnapshot.find({ location: location._id })
    .select('month totalDays totalAllowance rows.employee updatedAt')
    .sort({ month: -1 })
    .lean();

  return {
    location: { _id: location._id, name: location.name },
    months: list.map((s) => ({
      month: s.month,
      employees: s.rows.length,
      totalDays: s.totalDays,
      totalAllowance: s.totalAllowance,
      savedAt: s.updatedAt,
    })),
  };
};

// GET /saved/:month?location=<id> -> the saved copy of that month, exactly as it was when it was saved
// (this is what the PDF of a past month is made from).
const getSaved = async (params = {}, query = {}) => {
  const month = parseMonth(params.month);
  const location = await findOrFail(StaffLocation, idOf(query.location, 'location'), 'Location not found');

  let snapshot = await AttendanceSnapshot.findOne({ month, location: location._id }).lean();
  if (!snapshot) {
    await backfillSnapshots(location);
    snapshot = await AttendanceSnapshot.findOne({ month, location: location._id }).lean();
  }
  if (!snapshot) throw new ApiError(404, 'No saved attendance for that month');

  return {
    month,
    location: { _id: location._id, name: location.name },
    totalDays: snapshot.totalDays,
    ranges: plainRanges(snapshot.ranges),
    totalAllowance: snapshot.totalAllowance,
    savedAt: snapshot.updatedAt,
    employees: snapshot.rows.map((r) => ({
      _id: r.employee,
      employeeNo: r.employeeNo,
      name: r.name,
      arrivedDays: r.arrivedDays,
      extraDays: r.extraDays,
      arrivalDays: r.arrivalDays,
      leaveDays: r.leaveDays,
      medicalLeave: r.medicalLeave,
      casualLeave: r.casualLeave,
      noPayDays: r.noPayDays,
      arrivalPercentage: r.arrivalPercentage,
      allowance: r.allowance,
    })),
  };
};

// PUT { month, location, totalDays?, rows?: [{ employeeId, arrivedDays, extraDays, leaveDays, medicalLeave, casualLeave, noPayDays }] }
// Saves the rows sent (one record per employee per month) and / or the total days of the month.
// refreshRanges: true -> the month's frozen allowance ranges are replaced by the current ranges.
// Every save also stores a saved copy of the month (see saveSnapshot) for the "Saved months" list and the PDF.
// The counts are worked out here; the percentage and the allowance are worked out when the sheet is read.
const saveSheet = async (body = {}) => {
  const month = parseMonth(body.month);
  const locationId = idOf(body.location, 'location');
  const totalDays = readTotalDays(body.totalDays);
  const refreshRanges = body.refreshRanges === true;

  const rawRows = body.rows === undefined ? [] : body.rows;
  if (!Array.isArray(rawRows)) throw new ApiError(400, 'rows must be a list');
  if (rawRows.length === 0 && totalDays === undefined && !refreshRanges) throw new ApiError(400, 'There is nothing to save');
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

  // New total days: it becomes the standing number every month uses from now on (null = back to 25).
  // This month's saved copy (if it has one) gets it too; other saved months keep the total days they have.
  let newStanding;
  if (totalDays !== undefined) {
    newStanding = totalDays === null ? DEFAULT_TOTAL_DAYS : totalDays;
    await setStandingTotalDays(newStanding);
    await AttendanceMonth.deleteOne({ month }); // a value set for this single month (older versions) would hide the new one
    await AttendanceSnapshot.updateOne({ month, location: locationId }, { $set: { totalDays: newStanding } }); // no upsert: only if the month was saved
  }

  // Use the current ranges again: forget the frozen ones, the copy made below stores the current ones.
  if (refreshRanges) {
    await AttendanceSnapshot.deleteOne({ month, location: locationId });
  }

  const sheet = await getSheet({ month, location: locationId });
  await saveSnapshot(sheet);
  // the sheet was just stored, so its ranges are frozen from now on
  const saved = sheet.employees.length > 0 ? { ...sheet, rangesFrozen: true, rangesOutdated: !sameRanges(sheet.ranges, sheet.currentRanges) } : sheet;
  let message = 'Attendance saved successfully';
  if (refreshRanges && rows.length === 0 && totalDays === undefined) message = 'Current allowance ranges applied to this month';
  else if (newStanding !== undefined) message = `Attendance saved successfully. Total days ${newStanding} will be used for every month until you change it.`;
  return { message, ...saved };
};

module.exports = {
  saveSelection,
  forgetStaff,
  getRanges,
  setRanges,
  getSheet,
  saveSheet,
  listSaved,
  getSaved,
};