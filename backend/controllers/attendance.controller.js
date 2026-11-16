const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');

// PUT /api/staff-salary/attendance/selection   { location, staffIds: [...] }
// The staff members of that location who are on its attendance sheet (in the order they were added).
const saveSelection = asyncHandler(async (req, res) => {
  res.json(await attendanceService.saveSelection(req.body));
});

// GET /api/staff-salary/attendance?month=2026-11&location=<id>
// The sheet of that location: employees on it + their numbers of the month, total days, ranges, candidates.
const getSheet = asyncHandler(async (req, res) => {
  res.json(await attendanceService.getSheet(req.query));
});

// PUT /api/staff-salary/attendance
//   { month, location, totalDays? (1-31, null = the days of the calendar month),
//     rows?: [{ employeeId, arrivedDays, extraDays, leaveDays, medicalLeave, casualLeave, noPayDays }],
//     refreshRanges?: true  (use the current allowance ranges again for this month) }
// Every save also stores a saved copy of the month (used by the "Saved months" list and the PDF).
const saveSheet = asyncHandler(async (req, res) => {
  res.json(await attendanceService.saveSheet(req.body));
});

// GET /api/staff-salary/attendance/allowance-ranges   (the 3 default ranges are created on first use)
const getRanges = asyncHandler(async (req, res) => {
  res.json({ ranges: await attendanceService.getRanges() });
});

// PUT /api/staff-salary/attendance/allowance-ranges   { ranges: [{ minPercent: 90, amount: 5000 }, ...] }
const setRanges = asyncHandler(async (req, res) => {
  res.json(await attendanceService.setRanges(req.body));
});

// GET /api/staff-salary/attendance/saved?location=<id>
// Every month that was saved for that location (newest first): employees, total days, total allowance, saved at.
const listSaved = asyncHandler(async (req, res) => {
  res.json(await attendanceService.listSaved(req.query));
});

// GET /api/staff-salary/attendance/saved/2026-11?location=<id>
// The saved copy of that month, exactly as it was when it was saved (the PDF of a past month is made from it).
const getSaved = asyncHandler(async (req, res) => {
  res.json(await attendanceService.getSaved(req.params, req.query));
});

module.exports = { saveSelection, getSheet, saveSheet, getRanges, setRanges, listSaved, getSaved };