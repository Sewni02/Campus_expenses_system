const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/lecturerSalary.service');

// GET /api/lecturer-salary/formulas
const getFormulas = asyncHandler(async (req, res) => {
  res.json(await service.listFormulas());
});

// POST /api/lecturer-salary/formulas   { name, expression, description }   (super admin)
const createFormula = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createFormula(req.user, req.body));
});

// PUT /api/lecturer-salary/formulas/:id   (super admin)
const updateFormula = asyncHandler(async (req, res) => {
  res.json(await service.updateFormula(req.params.id, req.body));
});

// DELETE /api/lecturer-salary/formulas/:id   (super admin)
const deleteFormula = asyncHandler(async (req, res) => {
  res.json(await service.deleteFormula(req.params.id));
});

// GET /api/lecturer-salary/batches?faculty=management   (no faculty = all batches)
const getBatches = asyncHandler(async (req, res) => {
  res.json(await service.listBatches(req.query.faculty));
});

// POST /api/lecturer-salary/batches   { faculty, year, formulaId }   (super admin)
const createBatch = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createBatch(req.user, req.body));
});

// GET /api/lecturer-salary/batches/:id
const getBatch = asyncHandler(async (req, res) => {
  res.json(await service.getBatch(req.params.id));
});

// PATCH /api/lecturer-salary/batches/:id/settings   { formulaId }   (super admin; blank = Standard)
const updateBatchSettings = asyncHandler(async (req, res) => {
  res.json(await service.updateBatchSettings(req.params.id, req.body));
});

// DELETE /api/lecturer-salary/batches/:id   (super admin)
const deleteBatch = asyncHandler(async (req, res) => {
  res.json(await service.deleteBatch(req.params.id));
});

// POST /api/lecturer-salary/batches/:id/lecturers
//   { name, phone, subject, payType: 'formula'|'fixed', subFee, percentage, fixedSalary, formulaId,
//     bankName, bankBranch, accountNumber, accountHolder }
const addLecturer = asyncHandler(async (req, res) => {
  res.status(201).json(await service.addLecturer(req.user, req.params.id, req.body));
});

// PUT /api/lecturer-salary/batches/:id/lecturers/:lecturerId   (same body - this is also how bank details are changed)
const updateLecturer = asyncHandler(async (req, res) => {
  res.json(await service.updateLecturer(req.user, req.params.id, req.params.lecturerId, req.body));
});

// DELETE /api/lecturer-salary/batches/:id/lecturers/:lecturerId
const deleteLecturer = asyncHandler(async (req, res) => {
  res.json(await service.deleteLecturer(req.params.id, req.params.lecturerId));
});

// GET /api/lecturer-salary/salaries?month=2026-10&batch=<id optional>
const getSalaries = asyncHandler(async (req, res) => {
  res.json(await service.listSalaries(req.query));
});

// POST /api/lecturer-salary/salaries
//   { batchId, lecturerId, month, type: 'formula'|'fixed', formulaId, attendance, fixedAmount, note }
const createSalary = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createSalary(req.user, req.body));
});

// PUT /api/lecturer-salary/salaries/:salaryId   { type, formulaId, attendance, fixedAmount, note }   (drafts only)
const updateSalary = asyncHandler(async (req, res) => {
  res.json(await service.updateSalary(req.user, req.params.salaryId, req.body));
});

// DELETE /api/lecturer-salary/salaries/:salaryId   (drafts only)
const deleteSalary = asyncHandler(async (req, res) => {
  res.json(await service.deleteSalary(req.params.salaryId));
});

// POST /api/lecturer-salary/salaries/bulk   { month, batchId (optional), action: 'submit' | 'verify' }
const bulkAction = asyncHandler(async (req, res) => {
  res.json(await service.bulkAction(req.user, req.body));
});

// PATCH /api/lecturer-salary/salaries/:salaryId/action   { action: 'submit'|'verify'|'return'|'pay'|'unpay', note }
const salaryAction = asyncHandler(async (req, res) => {
  res.json(await service.salaryAction(req.user, req.params.salaryId, req.body.action, req.body.note));
});

module.exports = {
  getFormulas,
  createFormula,
  updateFormula,
  deleteFormula,
  getBatches,
  createBatch,
  getBatch,
  updateBatchSettings,
  deleteBatch,
  addLecturer,
  updateLecturer,
  deleteLecturer,
  getSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
  bulkAction,
  salaryAction,
};