const asyncHandler = require('../utils/asyncHandler');
const staffSalaryService = require('../services/staffSalary.service');

// GET /api/staff-salary/allowance-types   (the shared allowance list; the 6 defaults are created on first use)
const getAllowanceTypes = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.getAllowanceTypes());
});

// POST /api/staff-salary/allowance-types   { name }   (a new allowance for every employee)
const addAllowanceType = asyncHandler(async (req, res) => {
  const result = await staffSalaryService.addAllowanceType(req.body);
  res.status(201).json(result);
});

// GET /api/staff-salary/locations
const getLocations = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.getLocations());
});

// POST /api/staff-salary/locations   { name }
const addLocation = asyncHandler(async (req, res) => {
  const result = await staffSalaryService.addLocation(req.body);
  res.status(201).json(result);
});

// DELETE /api/staff-salary/locations/:id   (only a location with no staff)
const deleteLocation = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.deleteLocation(req.params.id));
});

// GET /api/staff-salary/staff?location=<id optional>
const getStaff = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.getStaff(req.query));
});

// POST /api/staff-salary/staff   { locationId, name, nic, mobile, joinedDate: 'YYYY-MM-DD', basicSalary }
const addStaff = asyncHandler(async (req, res) => {
  const result = await staffSalaryService.addStaff(req.body);
  res.status(201).json(result);
});

// PUT /api/staff-salary/staff/:id   { name, nic, mobile, joinedDate, basicSalary }   (this is also how the basic salary is changed)
const updateStaff = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.updateStaff(req.params.id, req.body));
});

// DELETE /api/staff-salary/staff/:id
const deleteStaff = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.deleteStaff(req.params.id));
});

// GET /api/staff-salary/salaries?month=2026-10&location=<id optional>
const getSalaries = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.getSalaries(req.query));
});

// POST /api/staff-salary/salaries   { staffId, month, allowances: [{ name, amount }] (names from the allowance list, 0 = not added), deductions: [{ name, amount }], note }
const createSalary = asyncHandler(async (req, res) => {
  const result = await staffSalaryService.createSalary(req.body, req.user.id);
  res.status(201).json(result);
});

// PUT /api/staff-salary/salaries/:id   { allowances, deductions, note }
const updateSalary = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.updateSalary(req.params.id, req.body));
});

// DELETE /api/staff-salary/salaries/:id
const deleteSalary = asyncHandler(async (req, res) => {
  res.json(await staffSalaryService.deleteSalary(req.params.id));
});

module.exports = {
  getAllowanceTypes,
  addAllowanceType,
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