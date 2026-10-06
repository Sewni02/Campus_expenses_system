const LecturerBatch = require('../models/lecturerBatch.model');
const LecturerSalary = require('../models/lecturerSalary.model');
const LecturerFormula = require('../models/lecturerFormula.model');
const { FormulaError, parseFormula, evaluateFormula } = require('../utils/lecturerFormula');
const User = require('../models/user.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { requireString, optionalString } = require('../utils/validators');

const FACULTIES = ['management', 'art'];
const PAY_TYPES = ['formula', 'fixed'];

const isAdmin = (user) => user.role === 'super_admin';
const isBlank = (v) => v === undefined || v === null || v === '';

// req.user only carries the id, so look the name up for "submitted by / verified by".
const actorName = async (user) => {
  const found = await User.findById(user.id).select('name');
  return found?.name || 'Unknown';
};

// ---------- Validation helpers ----------
// Accepts a number or a plain decimal string ("12", "12.5"); anything else -> NaN.
const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return NaN;
};
const round2 = (n) => Math.round(n * 100) / 100;

const validateFaculty = (value) => {
  if (!FACULTIES.includes(value)) throw new ApiError(400, 'Faculty must be "management" or "art"');
  return value;
};

const validateYear = (value) => {
  const year = toNumber(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, 'Batch year must be between 2000 and 2100');
  }
  return year;
};

const validateSubFee = (value) => {
  const fee = toNumber(value);
  if (!Number.isFinite(fee) || fee <= 0 || fee > 1_000_000_000) {
    throw new ApiError(400, 'Sub fee must be a number greater than 0');
  }
  return round2(fee);
};

const validatePercentage = (value) => {
  const pct = toNumber(value);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    throw new ApiError(400, 'Percentage must be greater than 0 and at most 100');
  }
  return round2(pct);
};

const validateFixedAmount = (value) => {
  const amount = toNumber(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new ApiError(400, 'Fixed salary must be a number greater than 0');
  }
  return round2(amount);
};

const validateAttendance = (value) => {
  const attendance = toNumber(value);
  if (!Number.isInteger(attendance) || attendance < 0 || attendance > 1_000_000) {
    throw new ApiError(400, 'Attendance must be a whole number (0 or more)');
  }
  return attendance;
};

const validateMonth = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ApiError(400, 'Month must look like 2026-10');
  }
  return value;
};

const validatePayType = (value, fallback = 'formula') => {
  if (isBlank(value)) return fallback;
  if (!PAY_TYPES.includes(value)) throw new ApiError(400, 'Pay type must be "formula" or "fixed"');
  return value;
};

// ---------- Formulas ----------
const DEFAULT_EXPRESSION = 'attendance * subFee * percentage%';

// The built-in "Standard" formula is created the first time formulas are needed.
const ensureDefaultFormula = async () => {
  let formula = await LecturerFormula.findOne({ isDefault: true });
  if (!formula) {
    formula = await LecturerFormula.create({
      name: 'Standard',
      expression: DEFAULT_EXPRESSION,
      description: 'Attendance x sub fee x percentage',
      isDefault: true,
    });
  }
  return formula;
};

// Turns a formula mistake (typo, unknown name...) into a clean 400 with a readable message.
const guardFormula = (fn) => {
  try {
    return fn();
  } catch (err) {
    if (err instanceof FormulaError) throw new ApiError(400, err.message);
    throw err;
  }
};

// Checks that a formula is written correctly by trying it with sample numbers.
const validateExpression = (value) => {
  const expression = requireString(value, 'Formula', { max: 200 });
  guardFormula(() => evaluateFormula(expression, { attendance: 20, subFee: 5000, percentage: 60 }, { allowNegative: true }));
  return expression;
};

const formulaFields = (body) => ({
  name: requireString(body.name, 'Formula name', { max: 60 }),
  expression: validateExpression(body.expression),
  description: optionalString(body.description, 'Description', { max: 200 }),
});

const listFormulas = async () => {
  await ensureDefaultFormula();
  return LecturerFormula.find().sort({ isDefault: -1, name: 1 });
};

const createFormula = async (user, body) => {
  const fields = formulaFields(body);
  if (await LecturerFormula.exists({ name: fields.name })) {
    throw new ApiError(409, 'A formula with this name already exists');
  }
  const formula = await LecturerFormula.create({ ...fields, createdBy: user.id });
  return { message: 'Formula added', formula };
};

// Salary entries already made keep the formula they were calculated with. Drafts pick up
// the new formula the next time they are edited and saved.
const updateFormula = async (id, body) => {
  const formula = await findOrFail(LecturerFormula, id, 'Formula not found');
  const fields = formulaFields(body);
  if (fields.name !== formula.name && (await LecturerFormula.exists({ name: fields.name }))) {
    throw new ApiError(409, 'A formula with this name already exists');
  }
  formula.set(fields);
  await formula.save();
  return { message: 'Formula updated', formula };
};

const deleteFormula = async (id) => {
  const formula = await findOrFail(LecturerFormula, id, 'Formula not found');
  if (formula.isDefault) throw new ApiError(400, 'The Standard formula cannot be deleted');
  if (await LecturerBatch.exists({ $or: [{ formula: formula._id }, { 'lecturers.formula': formula._id }] })) {
    throw new ApiError(400, 'This formula is used by a batch or a lecturer. Choose another formula for them first.');
  }
  await formula.deleteOne();
  return { message: 'Formula deleted' };
};

// Blank = "none chosen". Otherwise the formula must exist.
const validateFormulaRef = async (value) => {
  if (isBlank(value)) return undefined;
  const formula = await findOrFail(LecturerFormula, value, 'Formula not found');
  return formula._id;
};

// Which formula an entry uses: the one picked on the form, else the lecturer's, else the batch's, else Standard.
const resolveFormula = async (batch, lecturer, explicitId) => {
  if (!isBlank(explicitId)) return findOrFail(LecturerFormula, explicitId, 'Formula not found');
  const inherited = lecturer.formula || batch.formula;
  if (inherited) {
    const formula = await LecturerFormula.findById(inherited);
    if (formula) return formula;
  }
  return ensureDefaultFormula();
};

// Bank details are all optional, but bank + account number go together.
const bankFields = (body) => {
  const bankName = optionalString(body.bankName, 'Bank name', { max: 100 });
  const bankBranch = optionalString(body.bankBranch, 'Bank branch', { max: 100 });
  const accountHolder = optionalString(body.accountHolder, 'Account holder name', { max: 100 });
  const accountNumber = optionalString(body.accountNumber, 'Account number', { max: 20 });

  if (accountNumber && !/^\d{5,20}$/.test(accountNumber)) {
    throw new ApiError(400, 'Account number must be 5 to 20 digits');
  }
  if (accountNumber && !bankName) throw new ApiError(400, 'Select the bank for this account number');
  if (bankName && !accountNumber) throw new ApiError(400, 'Enter the account number for this bank');

  return { bankName, bankBranch, accountNumber, accountHolder };
};

// A "formula" lecturer needs sub fee + percentage. A "fixed" lecturer needs a fixed salary
// (sub fee / percentage are then optional - kept only if typed in).
const lecturerFields = (body) => {
  const payType = validatePayType(body.payType);
  const fields = {
    name: requireString(body.name, 'Lecturer name', { max: 100 }),
    phone: optionalString(body.phone, 'Phone', { max: 20 }),
    subject: requireString(body.subject, 'Subject', { max: 100 }),
    payType,
    ...bankFields(body),
  };

  if (payType === 'formula') {
    fields.subFee = validateSubFee(body.subFee);
    fields.percentage = validatePercentage(body.percentage);
    fields.fixedSalary = undefined;
  } else {
    fields.fixedSalary = validateFixedAmount(body.fixedSalary);
    fields.subFee = isBlank(body.subFee) ? undefined : validateSubFee(body.subFee);
    fields.percentage = isBlank(body.percentage) ? undefined : validatePercentage(body.percentage);
  }
  return fields;
};

const BANK_KEYS = ['bankName', 'bankBranch', 'accountNumber', 'accountHolder'];
const bankChanged = (lecturer, fields) => BANK_KEYS.some((k) => (lecturer[k] || '') !== (fields[k] || ''));

// ---------- Batches (super admin) ----------
// No faculty = every batch (used by the salary form's batch dropdown).
const listBatches = async (faculty) => {
  const filter = isBlank(faculty) ? {} : { faculty: validateFaculty(faculty) };
  const batches = await LecturerBatch.find(filter).sort({ faculty: 1, year: -1 });
  const formulas = await LecturerFormula.find();
  const names = new Map(formulas.map((f) => [f._id.toString(), f.name]));
  return batches.map((b) => ({
    _id: b._id,
    faculty: b.faculty,
    year: b.year,
    formulaId: b.formula || null,
    formulaName: (b.formula && names.get(b.formula.toString())) || null,
    legacyDeduction: !b.formula && (b.deductionPercent || 0) > 0 ? b.deductionPercent : 0,
    lecturerCount: b.lecturers.length,
  }));
};

const createBatch = async (user, body) => {
  const faculty = validateFaculty(body.faculty);
  const year = validateYear(body.year);

  if (await LecturerBatch.exists({ faculty, year })) {
    throw new ApiError(409, `The ${year} batch already exists in this faculty`);
  }
  const formula = await validateFormulaRef(body.formulaId);
  const batch = await LecturerBatch.create({ faculty, year, formula, createdBy: user.id });
  return { message: `${year} batch added`, batch };
};

// Choose the formula a batch uses (blank = Standard).
// Already-submitted/paid salaries keep the formula they were calculated with; drafts
// pick up the new formula the next time they are edited and saved.
const updateBatchSettings = async (id, body) => {
  const batch = await findOrFail(LecturerBatch, id, 'Batch not found');
  batch.formula = await validateFormulaRef(body.formulaId);
  batch.deductionPercent = 0; // the old deduction % setting is replaced by the formula
  await batch.save();
  return { message: 'Batch formula updated', batch };
};

const deleteBatch = async (id) => {
  const batch = await findOrFail(LecturerBatch, id, 'Batch not found');
  if (await LecturerSalary.exists({ batch: batch._id })) {
    throw new ApiError(400, 'This batch already has salary records, so it cannot be deleted');
  }
  await batch.deleteOne();
  return { message: 'Batch deleted' };
};

const getBatch = (id) => findOrFail(LecturerBatch, id, 'Batch not found');

// ---------- Lecturers (inside a batch) - accountant or super admin ----------
const addLecturer = async (user, batchId, body) => {
  const batch = await findOrFail(LecturerBatch, batchId, 'Batch not found');
  const fields = lecturerFields(body);
  fields.formula = fields.payType === 'formula' ? await validateFormulaRef(body.formulaId) : undefined;
  if (fields.bankName) {
    fields.bankUpdatedAt = new Date();
    fields.bankUpdatedByName = await actorName(user);
  }
  batch.lecturers.push(fields);
  await batch.save();
  return { message: 'Lecturer added', batch };
};

const updateLecturer = async (user, batchId, lecturerId, body) => {
  const batch = await findOrFail(LecturerBatch, batchId, 'Batch not found');
  const lecturer = batch.lecturers.id(lecturerId);
  if (!lecturer) throw new ApiError(404, 'Lecturer not found');

  const fields = lecturerFields(body);
  fields.formula = fields.payType === 'formula' ? await validateFormulaRef(body.formulaId) : undefined;
  if (bankChanged(lecturer, fields)) {
    fields.bankUpdatedAt = new Date();
    fields.bankUpdatedByName = await actorName(user);
  }
  lecturer.set(fields);
  await batch.save();
  return { message: 'Lecturer updated', batch };
};

const deleteLecturer = async (batchId, lecturerId) => {
  const batch = await findOrFail(LecturerBatch, batchId, 'Batch not found');
  const lecturer = batch.lecturers.id(lecturerId);
  if (!lecturer) throw new ApiError(404, 'Lecturer not found');

  if (await LecturerSalary.exists({ batch: batch._id, lecturer: lecturer._id })) {
    throw new ApiError(400, 'This lecturer already has salary records, so they cannot be removed');
  }
  lecturer.deleteOne();
  await batch.save();
  return { message: 'Lecturer removed', batch };
};

// ---------- Salary entries ----------
// Works out everything stored on one entry. Used by create AND edit.
const buildSalaryValues = async (batch, lecturer, input) => {
  const type = validatePayType(input.type, lecturer.payType || 'formula');
  const values = {
    faculty: batch.faculty,
    batchYear: batch.year,
    lecturerName: lecturer.name,
    subject: lecturer.subject,
    type,
    note: optionalString(input.note, 'Note', { max: 200 }),
  };

  if (type === 'formula') {
    const attendance = validateAttendance(input.attendance);
    const formula = await resolveFormula(batch, lecturer, input.formulaId);
    const { variables } = guardFormula(() => parseFormula(formula.expression));
    if (variables.includes('subFee') && !lecturer.subFee) {
      throw new ApiError(400, 'This formula needs the lecturer\'s sub fee. Add it in the lecturer details, or use a fixed salary.');
    }
    if (variables.includes('percentage') && !lecturer.percentage) {
      throw new ApiError(400, 'This formula needs the lecturer\'s percentage. Add it in the lecturer details, or use a fixed salary.');
    }
    const amount = guardFormula(() =>
      evaluateFormula(formula.expression, { attendance, subFee: lecturer.subFee || 0, percentage: lecturer.percentage || 0 })
    );
    return {
      ...values,
      formula: formula._id,
      formulaName: formula.name,
      expression: formula.expression,
      attendance,
      subFee: lecturer.subFee,
      percentage: lecturer.percentage,
      grossAmount: amount,
      deductionPercent: 0,
      amount,
    };
  }

  const amount = validateFixedAmount(input.fixedAmount);
  return {
    ...values,
    formula: undefined,
    formulaName: undefined,
    expression: undefined,
    attendance: undefined,
    subFee: undefined,
    percentage: undefined,
    grossAmount: amount,
    deductionPercent: 0,
    amount,
  };
};

// All entries of one month (optionally one batch only).
const listSalaries = async (query) => {
  const month = validateMonth(query.month);
  const filter = { month };
  if (!isBlank(query.batch)) filter.batch = query.batch;
  return LecturerSalary.find(filter).sort({ faculty: 1, batchYear: -1, lecturerName: 1, createdAt: 1 });
};

const createSalary = async (user, body) => {
  const month = validateMonth(body.month);
  const batch = await findOrFail(LecturerBatch, body.batchId, 'Batch not found');
  const lecturer = batch.lecturers.id(body.lecturerId);
  if (!lecturer) throw new ApiError(404, 'Lecturer not found in this batch');

  const values = await buildSalaryValues(batch, lecturer, body);
  const salary = await LecturerSalary.create({
    batch: batch._id,
    lecturer: lecturer._id,
    month,
    ...values,
    calculatedBy: user.id,
  });
  return { message: 'Salary saved as a draft', salary };
};

// Only a DRAFT can be edited; once submitted it is locked until the super admin sends it back.
const updateSalary = async (user, salaryId, body) => {
  const salary = await findOrFail(LecturerSalary, salaryId, 'Salary record not found');
  if (salary.status !== 'pending') {
    throw new ApiError(400, 'This salary is already submitted, so it can no longer be edited. The Super Admin can send it back.');
  }
  const batch = await findOrFail(LecturerBatch, salary.batch, 'Batch not found');
  const lecturer = batch.lecturers.id(salary.lecturer);
  if (!lecturer) throw new ApiError(404, 'Lecturer not found in this batch');

  // No formula picked in the edit = keep the one this entry already had (if it still exists).
  let formulaId = body.formulaId;
  if (isBlank(formulaId) && salary.formula && (await LecturerFormula.exists({ _id: salary.formula }))) {
    formulaId = salary.formula;
  }
  const values = await buildSalaryValues(batch, lecturer, { type: salary.type, ...body, formulaId });
  salary.set({ ...values, calculatedBy: user.id });
  await salary.save();
  return { message: 'Salary updated', salary };
};

const deleteSalary = async (salaryId) => {
  const salary = await findOrFail(LecturerSalary, salaryId, 'Salary record not found');
  if (salary.status !== 'pending') {
    throw new ApiError(400, 'Only a draft can be deleted. Ask the Super Admin to send it back first.');
  }
  await salary.deleteOne();
  return { message: 'Salary entry deleted' };
};

// One step in the approval flow:
//   submit  (accountant / admin)  draft      -> submitted
//   verify  (super admin)         submitted  -> verified
//   return  (super admin)         submitted | verified -> draft   (needs a note)
//   pay     (super admin)         verified   -> paid
//   unpay   (super admin)         paid       -> verified
const ADMIN_ACTIONS = ['verify', 'return', 'pay', 'unpay'];

const salaryAction = async (user, salaryId, action, note) => {
  if (![...ADMIN_ACTIONS, 'submit'].includes(action)) throw new ApiError(400, 'Unknown action');
  if (ADMIN_ACTIONS.includes(action) && !isAdmin(user)) {
    throw new ApiError(403, 'Only the Super Admin can do this');
  }

  const salary = await findOrFail(LecturerSalary, salaryId, 'Salary record not found');
  const mustBe = (...statuses) => {
    if (!statuses.includes(salary.status)) {
      throw new ApiError(400, `This salary is "${salary.status}", so it cannot be ${action === 'return' ? 'sent back' : `${action}ed`}`);
    }
  };
  const name = await actorName(user);
  const now = new Date();
  let message;

  if (action === 'submit') {
    mustBe('pending');
    salary.status = 'submitted';
    salary.submittedAt = now;
    salary.submittedByName = name;
    salary.returnNote = undefined;
    message = 'Submitted for verification';
  } else if (action === 'verify') {
    mustBe('submitted');
    salary.status = 'verified';
    salary.verifiedAt = now;
    salary.verifiedByName = name;
    message = 'Verified';
  } else if (action === 'return') {
    mustBe('submitted', 'verified');
    salary.returnNote = requireString(note, 'A note explaining why it is sent back', { max: 300 });
    salary.status = 'pending';
    salary.submittedAt = undefined;
    salary.submittedByName = undefined;
    salary.verifiedAt = undefined;
    salary.verifiedByName = undefined;
    message = 'Sent back to draft';
  } else if (action === 'pay') {
    mustBe('verified');
    // Keep the bank details the lecturer has RIGHT NOW with the payment record.
    const batch = await LecturerBatch.findById(salary.batch);
    const lecturer = batch?.lecturers.id(salary.lecturer);
    salary.status = 'paid';
    salary.paidDate = now;
    salary.paidByName = name;
    salary.paidBankName = lecturer?.bankName;
    salary.paidBankBranch = lecturer?.bankBranch;
    salary.paidAccountNumber = lecturer?.accountNumber;
    salary.paidAccountHolder = lecturer?.accountHolder;
    message = 'Marked as paid';
  } else {
    mustBe('paid');
    salary.status = 'verified';
    salary.paidDate = undefined;
    salary.paidByName = undefined;
    salary.paidBankName = undefined;
    salary.paidBankBranch = undefined;
    salary.paidAccountNumber = undefined;
    salary.paidAccountHolder = undefined;
    message = 'Payment undone - back to verified';
  }

  await salary.save();
  return { message, salary };
};

// Whole month at once (optionally one batch only):
//   submit (accountant / admin)  every draft    -> submitted
//   verify (super admin)         every submitted -> verified
const bulkAction = async (user, body) => {
  const month = validateMonth(body.month);
  const { action } = body;
  if (!['submit', 'verify'].includes(action)) throw new ApiError(400, 'Unknown action');
  if (action === 'verify' && !isAdmin(user)) throw new ApiError(403, 'Only the Super Admin can do this');

  const filter = { month };
  if (!isBlank(body.batchId)) filter.batch = body.batchId;
  const name = await actorName(user);
  const now = new Date();

  const result =
    action === 'submit'
      ? await LecturerSalary.updateMany(
          { ...filter, status: 'pending' },
          { $set: { status: 'submitted', submittedAt: now, submittedByName: name }, $unset: { returnNote: 1 } }
        )
      : await LecturerSalary.updateMany(
          { ...filter, status: 'submitted' },
          { $set: { status: 'verified', verifiedAt: now, verifiedByName: name } }
        );

  const verb = action === 'submit' ? 'submitted for verification' : 'verified';
  return { message: `${result.modifiedCount} salary entr${result.modifiedCount === 1 ? 'y' : 'ies'} ${verb}`, changed: result.modifiedCount };
};

module.exports = {
  listBatches,
  createBatch,
  listFormulas,
  createFormula,
  updateFormula,
  deleteFormula,
  updateBatchSettings,
  deleteBatch,
  getBatch,
  addLecturer,
  updateLecturer,
  deleteLecturer,
  listSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
  salaryAction,
  bulkAction,
};