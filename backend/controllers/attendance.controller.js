const asyncHandler = require('../utils/asyncHandler');
const attendanceService = require('../services/attendance.service');

// GET /api/staff-salary/attendance/employees
const getEmployees = asyncHandler(async (req, res) => {
  res.json(await attendanceService.getEmployees());
});

// POST /api/staff-salary/attendance/employees   { employeeNo, name }
const addEmployee = asyncHandler(async (req, res) => {
  const result = await attendanceService.addEmployee(req.body);
  res.status(201).json(result);
});

// PUT /api/staff-salary/attendance/employees/:id   { employeeNo, name }
const updateEmployee = asyncHandler(async (req, res) => {
  res.json(await attendanceService.updateEmployee(req.params.id, req.body));
});

// DELETE /api/staff-salary/attendance/employees/:id   (also deletes the attendance of that employee)
const deleteEmployee = asyncHandler(async (req, res) => {
  res.json(await attendanceService.deleteEmployee(req.params.id));
});

// GET /api/staff-salary/attendance?month=2026-11   (every employee + the days marked that month)
const getSheet = asyncHandler(async (req, res) => {
  res.json(await attendanceService.getSheet(req.query));
});

// PUT /api/staff-salary/attendance
//   { month, totalDays? (1-31, null = the days of the calendar month),
//     rows?: [{ employeeId, normalDates: [1, 2], extraDates: [7], medicalLeave, casualLeave, noPayDays }] }
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

module.exports = { getEmployees, addEmployee, updateEmployee, deleteEmployee, getSheet, saveSheet, getRanges, setRanges };