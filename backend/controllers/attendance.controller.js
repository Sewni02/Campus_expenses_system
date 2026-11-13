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
//     rows?: [{ employeeId, arrivedDays, extraDays, leaveDays, medicalLeave, casualLeave, noPayDays }] }
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

module.exports = { saveSelection, getSheet, saveSheet, getRanges, setRanges };