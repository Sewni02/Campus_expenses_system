const mongoose = require('mongoose');
const LecturerBatch = require('../models/lecturerBatch.model');
const LecturerSalary = require('../models/lecturerSalary.model');
const LecturerFormula = require('../models/lecturerFormula.model');
const Course = require('../models/course.model');
const { FormulaError, parseFormula, evaluateFormula } = require('../utils/lecturerFormula');
const User = require('../models/user.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { requireString, optionalString } = require('../utils/validators');

const PAY_TYPES = ['formula', 'fixed'];
const MODES = ['online', 'physical', 'recording'];
const MEDIUMS = ['english', 'sinhala', 'both'];
const ENTRY_MEDIUMS = ['english', 'sinhala']; // a salary entry is for one medium; a 'both' lecturer gets one entry per medium

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

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Degrees / courses (super admin adds them: Management, Art, B.Com ...) ----------
const findCourseByName = (name) => Course.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });

const listCourses = async () => {
  const courses = await Course.find().sort({ name: 1 });
  const counts = await LecturerBatch.aggregate([{ $group: { _id: '$faculty', n: { $sum: 1 } } }]);
  const byName = new Map(counts.map((c) => [c._id, c.n]));
  return courses.map((c) => ({ _id: c._id, name: c.name, batchCount: byName.get(c.name) || 0 }));
};

const createCourse = async (user, body) => {
  const name = requireString(body.name, 'Course name', { max: 60 });
  if (await findCourseByName(name)) throw new ApiError(409, `The course "${name}" already exists`);
  const course = await Course.create({ name, createdBy: user.id });
  return { message: `${name} added`, course };
};

// Renaming also renames it on the course's batches and their salary records.
const renameCourse = async (id, body) => {
  const course = await findOrFail(Course, id, 'Course not found');
  const name = requireString(body.name, 'Course name', { max: 60 });
  const clash = await findCourseByName(name);
  if (clash && clash._id.toString() !== course._id.toString()) throw new ApiError(409, `The course "${name}" already exists`);
  const oldName = course.name;
  course.name = name;
  await course.save();
  if (oldName !== name) {
    await LecturerBatch.updateMany({ faculty: oldName }, { $set: { faculty: name } });
    await LecturerSalary.updateMany({ faculty: oldName }, { $set: { faculty: name } });
  }
  return { message: 'Course renamed', course };
};

const deleteCourse = async (id) => {
  const course = await findOrFail(Course, id, 'Course not found');
  if (await LecturerBatch.exists({ faculty: course.name })) {
    throw new ApiError(400, 'This course still has batches, so it cannot be deleted');
  }
  await course.deleteOne();
  return { message: 'Course deleted' };
};

// Older data only had "management" / "art" typed into the batches. Turn every course name that
// is used by a batch but missing from the course list into a real course (runs at startup).
const migrateCourses = async () => {
  const used = await LecturerBatch.distinct('faculty');
  for (const raw of used) {
    if (!raw || (await findCourseByName(raw))) continue;
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    const existing = await findCourseByName(name);
    if (!existing) await Course.create({ name });
    if (name !== raw) {
      await LecturerBatch.updateMany({ faculty: raw }, { $set: { faculty: name } });
      await LecturerSalary.updateMany({ faculty: raw }, { $set: { faculty: name } });
    }
  }
};

const validateYear = (value) => {
  const year = toNumber(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, 'Batch year must be between 2000 and 2100');
  }
  return year;
};

const validateMedium = (value) => {
  if (!MEDIUMS.includes(value)) throw new ApiError(400, 'Choose the medium: English, Sinhala or Both');
  return value;
};

// The salary entry's medium. A lecturer who teaches in one language only cannot get entries in the other.
const checkEntryMedium = (value, lecturer) => {
  if (!ENTRY_MEDIUMS.includes(value)) throw new ApiError(400, 'Choose the medium: English or Sinhala');
  if (ENTRY_MEDIUMS.includes(lecturer.medium) && lecturer.medium !== value) {
    throw new ApiError(400, `${lecturer.name} teaches in ${lecturer.medium === 'english' ? 'English' : 'Sinhala'} only`);
  }
  return value;
};

// The parts (online / physical / recording) a lecturer teaches - at least one.
const validateModes = (value) => {
  const list = [...new Set(Array.isArray(value) ? value : [])];
  if (list.length === 0 || list.some((m) => !MODES.includes(m))) {
    throw new ApiError(400, 'Choose at least one part the lecturer teaches: online, physical or recording');
  }
  return MODES.filter((m) => list.includes(m));
};

// A salary entry can only be for a part the lecturer teaches (older lecturers without parts are allowed in any).
const checkLecturerMode = (mode, lecturer) => {
  // Recordings are made from online classes, so a lecturer who teaches online can also get recording entries.
  const teaches = (m) => lecturer.modes.includes(m) || (m === 'recording' && lecturer.modes.includes('online'));
  if (lecturer.modes && lecturer.modes.length > 0 && !teaches(mode)) {
    throw new ApiError(400, `${lecturer.name} does not teach ${mode}`);
  }
  return mode;
};

const validateMode = (value) => {
  if (!MODES.includes(value)) throw new ApiError(400, 'Choose the part of the batch: online, physical or recording');
  return value;
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

const validateRate = (value, label) => {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) throw new ApiError(400, `${label} must be a number greater than 0`);
  return round2(n);
};
const validateHours = (value) => {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) throw new ApiError(400, 'Hours must be a number greater than 0');
  return round2(n);
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
  guardFormula(() => evaluateFormula(expression, { attendance: 20, subFee: 5000, percentage: 60, hours: 10, hourRate: 500 }, { allowNegative: true }));
  return expression;
};

// ---- Attendance-range formulas: e.g. 1-10 = Rs. 500, 11-50 = Rs. 400 ----
const fmtMoney = (n) => `Rs. ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const validateTiers = (value, rangeBy) => {
  if (!Array.isArray(value) || value.length === 0) throw new ApiError(400, 'Add at least one range');
  if (value.length > 30) throw new ApiError(400, 'A formula can have at most 30 ranges');
  const whole = rangeBy !== 'hours'; // attendance = whole numbers, hours may have decimals
  const label = rangeBy === 'hours' ? 'hours' : 'attendance';
  const tiers = value.map((t, i) => {
    const from = toNumber(t.from);
    const open = isBlank(t.to); // no "to" = and above
    const to = open ? null : toNumber(t.to);
    const amount = toNumber(t.amount);
    const okNumber = (n) => Number.isFinite(n) && n >= 0 && n <= 1_000_000 && (!whole || Number.isInteger(n));
    if (!okNumber(from) || (!open && (!okNumber(to) || to < from))) {
      throw new ApiError(400, `Range ${i + 1}: "from" and "to" must be ${whole ? 'whole numbers' : 'numbers'} for ${label}, and "to" cannot be less than "from" (leave "to" empty for "and above")`);
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw new ApiError(400, `Range ${i + 1}: the amount must be greater than 0`);
    }
    const payBy = ['total', 'unit', 'rate'].includes(t.payBy) ? t.payBy : t.perUnit === true || t.perUnit === 'true' ? 'unit' : 'total';
    // "rate": attendance x (amount x percentage%). The percentage may be set on the range; empty = the lecturer's percentage.
    const percentage = payBy === 'rate' && !isBlank(t.percentage) ? validatePercentage(t.percentage) : undefined;
    return { from, to, amount: round2(amount), payBy, perUnit: payBy === 'unit', percentage };
  });
  tiers.sort((a, b) => a.from - b.from || (a.to ?? Infinity) - (b.to ?? Infinity));
  const open = tiers.filter((t) => t.to === null);
  if (open.length > 1 || (open.length === 1 && tiers[tiers.length - 1].to !== null)) {
    throw new ApiError(400, 'Only the last range (the highest "from") can be left open with no "to"');
  }
  return tiers;
};

// The first range that contains the value (a number shared by two ranges, e.g. 10, uses the lower range).
const findTier = (tiers, value) => tiers.find((t) => value >= t.from && (t.to === null || t.to === undefined || value <= t.to));

// Older range formulas had a single "per attendance" switch for every range.
// How a range pays: 'total' | 'unit' (amount x attendance) | 'rate' (attendance x (amount x percentage%)). Older formulas only had the unit/total switch.
const tierPay = (formula, tier) => tier.payBy || (tier.perUnit === true || formula.rangeBasis === 'perAttendance' ? 'unit' : 'total');

const tierLabel = (t) => (t.to === null || t.to === undefined ? `${t.from}+` : `${t.from}-${t.to}`);

const describeTiers = (tiers, rangeBy) =>
  `${rangeBy === 'hours' ? 'By hours' : 'By attendance'}: ` +
  tiers
    .map((t) => {
      const unit = rangeBy === 'hours' ? 'hour' : 'attendance';
      if (t.payBy === 'rate') return `${tierLabel(t)} = ${unit} x (${fmtMoney(t.amount)} x ${t.percentage ? `${t.percentage}%` : 'lecturer %'})`;
      return `${tierLabel(t)} = ${fmtMoney(t.amount)}${t.payBy === 'unit' ? ` per ${unit}` : ''}`;
    })
    .join(' | ');

const formulaFields = (body) => {
  const kind = body.kind === 'range' ? 'range' : 'expression';
  const base = {
    name: requireString(body.name, 'Formula name', { max: 60 }),
    description: optionalString(body.description, 'Description', { max: 200 }),
    degree: optionalString(body.degree, 'Degree', { max: 60 }) || undefined,
    kind,
  };
  if (kind === 'range') {
    const rangeBy = body.rangeBy === 'hours' ? 'hours' : 'attendance';
    const tiers = validateTiers(body.tiers, rangeBy);
    return { ...base, tiers, rangeBy, rangeBasis: 'fixed', expression: describeTiers(tiers, rangeBy) };
  }
  return { ...base, tiers: [], rangeBy: 'attendance', rangeBasis: 'fixed', expression: validateExpression(body.expression) };
};

// Which of the lecturer's rates a formula needs (so the lecturer form only asks for those).
const formulaNeeds = (formula) => {
  if (formula && formula.kind === 'range') {
    // Only a range paid as "attendance x (sub fee x percentage)" without its own percentage needs the lecturer's percentage.
    const needsPct = (formula.tiers || []).some((t) => tierPay(formula, t) === 'rate' && (t.percentage === null || t.percentage === undefined));
    return { subFee: false, percentage: needsPct, hourRate: false };
  }
  if (!formula) return { subFee: false, percentage: false, hourRate: false };
  const { variables } = guardFormula(() => parseFormula(formula.expression));
  return { subFee: variables.includes('subFee'), percentage: variables.includes('percentage'), hourRate: variables.includes('hourRate') };
};

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
const validateFormulaRef = async (value, faculty) => {
  if (isBlank(value)) return undefined;
  const formula = await findOrFail(LecturerFormula, value, 'Formula not found');
  if (faculty && formula.degree && formula.degree.toLowerCase() !== String(faculty).toLowerCase()) {
    throw new ApiError(400, `The formula "${formula.name}" is only for the ${formula.degree} degree`);
  }
  return formula._id;
};

// Which formula an entry uses: the one picked on the form, else the lecturer's, else the batch's, else Standard.
// Which formula pays an entry: the one picked on the salary form, else the lecturer's own formula,
// else the batch's formula for that medium (English / Sinhala), else the batch formula, else Standard.
const resolveFormula = async (batch, lecturer, explicitId, medium) => {
  if (!isBlank(explicitId)) {
    const formula = await findOrFail(LecturerFormula, explicitId, 'Formula not found');
    if (formula.degree && formula.degree.toLowerCase() !== String(batch.faculty).toLowerCase()) {
      throw new ApiError(400, `The formula "${formula.name}" is only for the ${formula.degree} degree`);
    }
    return formula;
  }
  const byMedium = medium && batch.mediumFormulas ? batch.mediumFormulas[medium] : undefined;
  const inherited = lecturer.formula || byMedium || batch.formula;
  if (inherited) {
    const formula = await LecturerFormula.findById(inherited);
    if (formula) return formula;
  }
  return ensureDefaultFormula();
};

// A rate (sub fee, percentage, hourly rate) is required on the lecturer for a medium only when that medium's formula needs it
// (the batch can have a different formula for English and for Sinhala).
const lecturerNeeds = async (batch, formulaRef) => {
  const needs = {};
  for (const m of ENTRY_MEDIUMS) {
    needs[m] = formulaNeeds(await resolveFormula(batch, formulaRef ? { formula: formulaRef } : {}, undefined, m));
  }
  return needs;
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
// The rates the lecturer has for ONE medium (falls back to the older plain fields).
const rateOf = (lecturer, medium, key) => {
  const r = lecturer.rates && medium ? lecturer.rates[medium] : undefined;
  return r && r[key] !== undefined && r[key] !== null ? r[key] : lecturer[key];
};

const MEDIUM_NAME = { english: 'English', sinhala: 'Sinhala' };
const DEFAULT_NEEDS = { subFee: true, percentage: true, hourRate: false };

// "needsBy" = which rates the formula of each medium uses; only those are required (the rest are optional).
// The lecturer has their own rates for every medium they teach: body.rates = { english: {...}, sinhala: {...} }.
const lecturerFields = (body, needsBy = { english: DEFAULT_NEEDS, sinhala: DEFAULT_NEEDS }) => {
  const payType = validatePayType(body.payType);
  const fields = {
    name: requireString(body.name, 'Lecturer name', { max: 100 }),
    phone: optionalString(body.phone, 'Phone', { max: 20 }),
    subject: requireString(body.subject, 'Subject', { max: 100 }),
    medium: validateMedium(body.medium),
    modes: validateModes(body.modes),
    payType,
    ...bankFields(body),
  };

  const taught = fields.medium === 'both' ? ENTRY_MEDIUMS : [fields.medium];
  const optional = (value, check) => (isBlank(value) ? undefined : check(value));
  const rates = {};
  for (const m of taught) {
    // Older clients send the plain fields instead of body.rates.
    const r = body.rates ? body.rates[m] || {} : body;
    const needs = needsBy[m] || DEFAULT_NEEDS;
    try {
      if (payType === 'formula') {
        rates[m] = {
          subFee: needs.subFee ? validateSubFee(r.subFee) : optional(r.subFee, validateSubFee),
          percentage: needs.percentage ? validatePercentage(r.percentage) : optional(r.percentage, validatePercentage),
          hourRate: needs.hourRate ? validateRate(r.hourRate, 'Hourly rate') : optional(r.hourRate, (v) => validateRate(v, 'Hourly rate')),
        };
      } else {
        rates[m] = {
          fixedSalary: validateFixedAmount(r.fixedSalary),
          subFee: optional(r.subFee, validateSubFee),
          percentage: optional(r.percentage, validatePercentage),
          hourRate: optional(r.hourRate, (v) => validateRate(v, 'Hourly rate')),
        };
      }
    } catch (err) {
      if (taught.length > 1 && err instanceof ApiError) throw new ApiError(err.statusCode || 400, `${MEDIUM_NAME[m]} medium: ${err.message}`);
      throw err;
    }
  }
  fields.rates = { english: rates.english, sinhala: rates.sinhala };
  // keep the first medium's rates in the plain fields too
  const first = rates[taught[0]] || {};
  fields.subFee = first.subFee;
  fields.percentage = first.percentage;
  fields.hourRate = first.hourRate;
  fields.fixedSalary = first.fixedSalary;
  return fields;
};

const BANK_KEYS = ['bankName', 'bankBranch', 'accountNumber', 'accountHolder'];
const bankChanged = (lecturer, fields) => BANK_KEYS.some((k) => (lecturer[k] || '') !== (fields[k] || ''));

// ---------- Batches (super admin) ----------
// No faculty = every batch (used by the salary form's batch dropdown).
const listBatches = async (faculty) => {
  const filter = isBlank(faculty) ? {} : { faculty: String(faculty) };
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
  const course = await findCourseByName(requireString(body.faculty, 'Course', { max: 60 }));
  if (!course) throw new ApiError(400, 'Course not found. Add the course first');
  const faculty = course.name;
  const year = validateYear(body.year);

  if (await LecturerBatch.exists({ faculty, year })) {
    throw new ApiError(409, `The ${year} batch already exists in this faculty`);
  }
  const formula = await validateFormulaRef(body.formulaId, faculty);
  const batch = await LecturerBatch.create({ faculty, year, formula, createdBy: user.id });
  return { message: `${year} batch added`, batch };
};

// Choose the formula a batch uses (blank = Standard).
// Already-submitted/paid salaries keep the formula they were calculated with; drafts
// pick up the new formula the next time they are edited and saved.
const updateBatchSettings = async (id, body) => {
  const batch = await findOrFail(LecturerBatch, id, 'Batch not found');
  batch.formula = await validateFormulaRef(body.formulaId, batch.faculty);
  if (body.mediumFormulas && typeof body.mediumFormulas === 'object') {
    batch.mediumFormulas = {
      english: await validateFormulaRef(body.mediumFormulas.english, batch.faculty),
      sinhala: await validateFormulaRef(body.mediumFormulas.sinhala, batch.faculty),
    };
  }
  batch.deductionPercent = 0; // the old deduction % setting is replaced by the formula
  await batch.save();
  return { message: 'Batch formulas updated', batch };
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
  const formulaRef = await validateFormulaRef(body.formulaId, batch.faculty);
  const needs = await lecturerNeeds(batch, formulaRef);
  const fields = lecturerFields(body, needs);
  fields.formula = fields.payType === 'formula' ? formulaRef : undefined;
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

  const formulaRef = await validateFormulaRef(body.formulaId, batch.faculty);
  const needs = await lecturerNeeds(batch, formulaRef);
  const fields = lecturerFields(body, needs);
  fields.formula = fields.payType === 'formula' ? formulaRef : undefined;
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
    mode: checkLecturerMode(validateMode(input.mode), lecturer),
    medium: checkEntryMedium(input.medium, lecturer),
    type,
    note: optionalString(input.note, 'Note', { max: 200 }),
  };

  if (type === 'formula') {
    const formula = await resolveFormula(batch, lecturer, input.formulaId, input.medium);

    // Range formula: the attendance (or the hours) picks the range, the range gives the amount.
    if (formula.kind === 'range') {
      const byHours = formula.rangeBy === 'hours';
      const attendance = byHours ? undefined : validateAttendance(input.attendance);
      const hours = byHours ? validateHours(input.hours) : undefined;
      const value = byHours ? hours : attendance;
      const word = byHours ? 'Hours' : 'Attendance';
      const tier = findTier(formula.tiers, value);
      if (!tier) {
        throw new ApiError(400, `No range in "${formula.name}" covers ${word.toLowerCase()} ${value}. Add a range for it in the Formulas tab.`);
      }
      const payBy = tierPay(formula, tier);
      let percentage;
      if (payBy === 'rate') {
        percentage = tier.percentage ? tier.percentage : isBlank(input.percentage) ? rateOf(lecturer, input.medium, 'percentage') : validatePercentage(input.percentage);
        if (!percentage) throw new ApiError(400, 'This range needs the lecturer\'s percentage. Type it in, or add it in the lecturer details.');
      }
      const amount = round2(payBy === 'rate' ? value * tier.amount * (percentage / 100) : payBy === 'unit' ? tier.amount * value : tier.amount);
      return {
        ...values,
        formula: formula._id,
        formulaName: formula.name,
        expression: formula.expression,
        attendance,
        hours,
        subFee: payBy === 'rate' ? tier.amount : undefined,
        percentage,
        hourRate: undefined,
        calcText:
          payBy === 'rate'
            ? `${word} ${value} falls in ${tierLabel(tier)}: ${value} x (${fmtMoney(tier.amount)} x ${percentage}%)`
            : payBy === 'unit'
              ? `${word} ${value} falls in ${tierLabel(tier)}: ${value} x ${fmtMoney(tier.amount)}`
              : `${word} ${value} falls in ${tierLabel(tier)}: ${fmtMoney(tier.amount)}`,
        grossAmount: amount,
        deductionPercent: 0,
        amount,
      };
    }

    const { variables } = guardFormula(() => parseFormula(formula.expression));
    const attendance = variables.includes('attendance') ? validateAttendance(input.attendance) : undefined;
    const hours = variables.includes('hours') ? validateHours(input.hours) : undefined;
    let hourRate;
    if (variables.includes('hourRate')) {
      const raw = isBlank(input.hourRate) ? rateOf(lecturer, input.medium, 'hourRate') : input.hourRate;
      if (isBlank(raw)) throw new ApiError(400, 'This formula needs the hourly rate. Type it in, or add it in the lecturer details.');
      hourRate = validateRate(raw, 'Hourly rate');
    }
    // Online / physical / recording can have different rates, so the entry may carry its own
    // sub fee and percentage (blank = the lecturer's normal ones).
    const subFee = isBlank(input.subFee) ? rateOf(lecturer, input.medium, 'subFee') : validateSubFee(input.subFee);
    const percentage = isBlank(input.percentage) ? rateOf(lecturer, input.medium, 'percentage') : validatePercentage(input.percentage);
    if (variables.includes('subFee') && !subFee) {
      throw new ApiError(400, 'This formula needs the lecturer\'s sub fee. Add it in the lecturer details, or use a fixed salary.');
    }
    if (variables.includes('percentage') && !percentage) {
      throw new ApiError(400, 'This formula needs the lecturer\'s percentage. Add it in the lecturer details, or use a fixed salary.');
    }
    const amount = guardFormula(() =>
      evaluateFormula(formula.expression, { attendance: attendance || 0, subFee: subFee || 0, percentage: percentage || 0, hours: hours || 0, hourRate: hourRate || 0 })
    );
    return {
      ...values,
      formula: formula._id,
      formulaName: formula.name,
      expression: formula.expression,
      attendance,
      subFee: variables.includes('subFee') ? subFee : undefined,
      percentage: variables.includes('percentage') ? percentage : undefined,
      hours,
      hourRate,
      calcText: undefined,
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
    hours: undefined,
    hourRate: undefined,
    calcText: undefined,
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

  // No formula sent = use the lecturer's formula, else the batch's formula, else Standard
  // (so a draft always follows the formula saved on the batch).
  const values = await buildSalaryValues(batch, lecturer, { type: salary.type, ...body });
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
    throw new ApiError(400, 'Salaries are paid from the Payments tab: one payment per lecturer for all their batches');
  } else {
    mustBe('paid');
    salary.status = 'verified';
    salary.paymentId = undefined;
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



// ---------- Payments: ONE payment per lecturer per month, across all their batches ----------
// The same person teaches in several batches (each batch has its own lecturer row), so people are
// matched by phone number, or by name when there is no phone number.
const personKey = (lecturer) => {
  const digits = String(lecturer.phone || '').replace(/\D/g, '');
  if (digits.length >= 7) return `tel:${digits}`;
  return `name:${String(lecturer.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
};

// Every distinct lecturer over all batches (used to suggest names when adding a lecturer).
const listPeople = async () => {
  const batches = await LecturerBatch.find().sort({ year: -1 });
  const people = new Map();
  for (const b of batches) {
    for (const l of b.lecturers) {
      const key = personKey(l);
      const prev = people.get(key);
      if (!prev) {
        people.set(key, { key, name: l.name, phone: l.phone, subject: l.subject, medium: l.medium, modes: l.modes, rates: l.toObject().rates, subFee: l.subFee, percentage: l.percentage, hourRate: l.hourRate, fixedSalary: l.fixedSalary, payType: l.payType, bankName: l.bankName, bankBranch: l.bankBranch, accountNumber: l.accountNumber, accountHolder: l.accountHolder, batches: 1 });
      } else {
        prev.batches += 1;
        if (!prev.accountNumber && l.accountNumber) Object.assign(prev, { bankName: l.bankName, bankBranch: l.bankBranch, accountNumber: l.accountNumber, accountHolder: l.accountHolder });
      }
    }
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const lecturersOfEntries = async (salaries) => {
  const batches = await LecturerBatch.find({ _id: { $in: [...new Set(salaries.map((s) => s.batch.toString()))] } });
  const lecturerOf = new Map();
  for (const b of batches) for (const l of b.lecturers) lecturerOf.set(l._id.toString(), l);
  return lecturerOf;
};

// Everything owed to each lecturer in a month, with all their batches added together.
const listPayments = async (query) => {
  const month = validateMonth(query.month);
  const salaries = await LecturerSalary.find({ month }).sort({ faculty: 1, batchYear: -1, createdAt: 1 });
  const lecturerOf = await lecturersOfEntries(salaries);

  const people = new Map();
  for (const sal of salaries) {
    const lec = lecturerOf.get(sal.lecturer.toString()) || { name: sal.lecturerName, subject: sal.subject };
    const key = personKey(lec);
    if (!people.has(key)) {
      people.set(key, { key, name: lec.name, phone: lec.phone, subjects: new Set(), bank: null, items: [], total: 0, readyTotal: 0, paidTotal: 0, notReadyTotal: 0, paidDate: null, paidByName: null });
    }
    const p = people.get(key);
    p.subjects.add(sal.subject);
    if (!p.bank && lec.accountNumber) p.bank = { bankName: lec.bankName, bankBranch: lec.bankBranch, accountNumber: lec.accountNumber, accountHolder: lec.accountHolder };
    p.items.push({ _id: sal._id, faculty: sal.faculty, batchYear: sal.batchYear, mode: sal.mode, medium: sal.medium, type: sal.type, amount: sal.amount, status: sal.status, note: sal.note, paidDate: sal.paidDate });
    p.total += sal.amount;
    if (sal.status === 'verified') p.readyTotal += sal.amount;
    else if (sal.status === 'paid') { p.paidTotal += sal.amount; p.paidDate = sal.paidDate; p.paidByName = sal.paidByName; }
    else p.notReadyTotal += sal.amount;
  }
  return [...people.values()]
    .map((p) => ({
      ...p,
      subjects: [...p.subjects],
      total: round2(p.total),
      readyTotal: round2(p.readyTotal),
      paidTotal: round2(p.paidTotal),
      notReadyTotal: round2(p.notReadyTotal),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// The date the money was paid (YYYY-MM-DD): today or an earlier day, not in the future.
const validatePaymentDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new ApiError(400, 'Enter the payment date');
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, 'The payment date is not a real date');
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 1); // allow for time zones ahead of UTC
  if (date > limit) throw new ApiError(400, 'The payment date cannot be in the future');
  if (date < new Date('2000-01-01T00:00:00Z')) throw new ApiError(400, 'The payment date is too old');
  return date;
};

// Pay (or undo paying) ONE lecturer's whole month in a single payment. Super admin only.
//   pay   : every unpaid entry (draft / submitted / verified) of that person in that month becomes paid together
//   unpay : every PAID entry of that person in that month goes back to verified
const payLecturer = async (user, body) => {
  if (!isAdmin(user)) throw new ApiError(403, 'Only the Super Admin can do this');
  const month = validateMonth(body.month);
  const key = requireString(body.personKey, 'Lecturer', { max: 200 });
  if (!['pay', 'unpay'].includes(body.action)) throw new ApiError(400, 'Unknown action');

  const all = await LecturerSalary.find({ month });
  const lecturerOf = await lecturersOfEntries(all);
  const mine = all.filter((sal) => personKey(lecturerOf.get(sal.lecturer.toString()) || { name: sal.lecturerName }) === key);
  const name = await actorName(user);

  if (body.action === 'pay') {
    // "Verify": the super admin checks the lecturer's whole month and pays it in one go - draft, submitted and
    // verified entries all become paid, on the payment date that was typed in.
    const paymentDate = validatePaymentDate(body.paymentDate);
    const ready = mine.filter((s) => s.status !== 'paid');
    if (ready.length === 0) throw new ApiError(400, 'There is nothing left to pay for this lecturer in this month');
    // Bank details the lecturer has RIGHT NOW stay with the payment record.
    const withBank = mine.map((s) => lecturerOf.get(s.lecturer.toString())).find((l) => l && l.accountNumber);
    const paymentId = new mongoose.Types.ObjectId();
    const now = new Date();
    for (const sal of ready) {
      // entries that skipped the submit / verify steps are marked as checked by the super admin now
      if (sal.status === 'pending') { sal.submittedAt = now; sal.submittedByName = name; }
      if (sal.status !== 'verified') { sal.verifiedAt = now; sal.verifiedByName = name; }
      sal.returnNote = undefined;
      sal.status = 'paid';
      sal.paymentId = paymentId;
      sal.paidDate = paymentDate;
      sal.paidByName = name;
      sal.paidBankName = withBank?.bankName;
      sal.paidBankBranch = withBank?.bankBranch;
      sal.paidAccountNumber = withBank?.accountNumber;
      sal.paidAccountHolder = withBank?.accountHolder;
      await sal.save();
    }
    const total = round2(ready.reduce((t, s) => t + s.amount, 0));
    return { message: `Paid ${ready.length} entr${ready.length === 1 ? 'y' : 'ies'} together (Rs. ${total.toFixed(2)})`, changed: ready.length };
  }

  const paid = mine.filter((s) => s.status === 'paid');
  if (paid.length === 0) throw new ApiError(400, 'This lecturer has no paid entries in this month');
  for (const sal of paid) {
    sal.status = 'verified';
    for (const f of ['paymentId', 'paidDate', 'paidByName', 'paidBankName', 'paidBankBranch', 'paidAccountNumber', 'paidAccountHolder']) sal[f] = undefined;
    await sal.save();
  }
  return { message: 'Payment undone — back to verified', changed: paid.length };
};


// ---------- Batch summary: every lecturer's total in one batch ----------
// Totals per lecturer, split by part (online / physical / recording) and medium (English / Sinhala).
// month = '2026-10' for one month, or 'all' (the default) for the whole time.
const batchSummary = async (id, query) => {
  const batch = await findOrFail(LecturerBatch, id, 'Batch not found');
  const month = isBlank(query.month) || query.month === 'all' ? 'all' : validateMonth(query.month);
  const filter = { batch: batch._id };
  if (month !== 'all') filter.month = month;
  const salaries = await LecturerSalary.find(filter);

  const blank = (extra) => ({ ...extra, cells: {}, total: 0, paid: 0, notPaid: 0, entries: 0 });
  const rows = new Map();
  // every lecturer of the batch is listed (even with no salary yet)
  for (const l of batch.lecturers) rows.set(l._id.toString(), blank({ lecturerId: l._id, name: l.name, subject: l.subject, medium: l.medium }));
  const totals = blank({});
  const add = (row, key, sal) => {
    row.cells[key] = round2((row.cells[key] || 0) + sal.amount);
    row.total = round2(row.total + sal.amount);
    if (sal.status === 'paid') row.paid = round2(row.paid + sal.amount);
    else row.notPaid = round2(row.notPaid + sal.amount);
    row.entries += 1;
  };
  for (const sal of salaries) {
    const lid = sal.lecturer.toString();
    if (!rows.has(lid)) rows.set(lid, blank({ lecturerId: sal.lecturer, name: sal.lecturerName, subject: sal.subject, removed: true }));
    const key = `${sal.mode || 'none'}|${sal.medium || 'none'}`;
    add(rows.get(lid), key, sal);
    add(totals, key, sal);
  }
  return {
    batch: { _id: batch._id, faculty: batch.faculty, year: batch.year },
    month,
    rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totals,
  };
};

module.exports = {
  batchSummary,
  listPeople,
  listPayments,
  payLecturer,
  listCourses,
  createCourse,
  renameCourse,
  deleteCourse,
  migrateCourses,
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