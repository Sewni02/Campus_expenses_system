const Contractor = require('../models/contractor.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { validateAmount } = require('../utils/validators');
const { containsRegex } = require('../utils/escapeRegex');

// Generates a short, human-readable invoice number, e.g. INV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `INV-${timePart}-${randPart}`;
};

const getContractors = async ({ search }) => {
  const filter = search ? { name: containsRegex(search) } : {};
  return Contractor.find(filter).sort({ createdAt: -1 });
};

const createContractor = async ({ name, phone, registrationDate, accountNumber, bankName, bankBranch }) => {
  if (!name || !phone) {
    throw new ApiError(400, 'name and phone are required');
  }
  const contractor = await Contractor.create({ name, phone, registrationDate, accountNumber, bankName, bankBranch });
  return { message: 'Contractor added successfully', contractor };
};

const updateContractor = async (id, { name, phone, registrationDate, accountNumber, bankName, bankBranch }) => {
  const contractor = await Contractor.findByIdAndUpdate(
    id,
    { name, phone, registrationDate, accountNumber, bankName, bankBranch },
    { new: true, runValidators: true }
  );

  if (!contractor) {
    throw new ApiError(404, 'Contractor not found');
  }

  return { message: 'Contractor updated successfully', contractor };
};

const deleteContractor = async (id) => {
  const contractor = await Contractor.findByIdAndDelete(id);

  if (!contractor) {
    throw new ApiError(404, 'Contractor not found');
  }

  return { message: 'Contractor deleted successfully' };
};

// Add an estimation plan a contractor has submitted for a project.
// A single contractor can have many plans, and many contractors can
// each have a plan against the same projectName.
const addEstimationPlan = async (id, { projectName, totalEstimate, note }, files) => {
  if (!projectName || !totalEstimate) {
    throw new ApiError(400, 'projectName and totalEstimate are required');
  }

  const cleanEstimate = validateAmount(totalEstimate, 'totalEstimate');

  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const planFileUrl = files?.plan?.[0]?.path;

  contractor.estimationPlans.push({
    projectName,
    totalEstimate: cleanEstimate,
    note,
    planFileUrl,
  });
  await contractor.save();

  return { message: 'Estimation plan added successfully', contractor };
};

const updateEstimationPlan = async (id, planId, { projectName, totalEstimate, note }, files) => {
  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const plan = contractor.estimationPlans.id(planId);
  if (!plan) {
    throw new ApiError(404, 'Estimation plan not found');
  }

  if (projectName !== undefined) plan.projectName = projectName;
  if (totalEstimate !== undefined && totalEstimate !== '') plan.totalEstimate = validateAmount(totalEstimate, 'totalEstimate');
  if (note !== undefined) plan.note = note;

  const planFileUrl = files?.plan?.[0]?.path;
  if (planFileUrl) plan.planFileUrl = planFileUrl;

  await contractor.save({ validateModifiedOnly: true });

  return { message: 'Estimation plan updated successfully', contractor };
};

const deleteEstimationPlan = async (id, planId) => {
  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const plan = contractor.estimationPlans.id(planId);
  if (!plan) {
    throw new ApiError(404, 'Estimation plan not found');
  }

  plan.deleteOne();
  await contractor.save();

  return { message: 'Estimation plan deleted successfully', contractor };
};

// STEP 1 of the invoice flow: raise an invoice against one of the
// contractor's estimation plans. This is created with status 'pending' and
// only carries invoice-side details (amount, reason, the bill file received
// from the contractor). No payment/bank info exists yet - that only gets
// attached once finance actually pays it (see payInvoice below).
const createInvoice = async (id, { amount, date, reason, note, planId }, files) => {
  if (!amount) {
    throw new ApiError(400, 'amount is required');
  }
  if (!planId) {
    throw new ApiError(400, 'planId is required - invoices must be linked to an estimation plan');
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'reason is required');
  }
  const cleanAmount = validateAmount(amount);

  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const plan = contractor.estimationPlans.id(planId);
  if (!plan) {
    throw new ApiError(404, 'Estimation plan not found for this contractor');
  }

  const billUrl = files?.bill?.[0]?.path;

  contractor.payments.push({
    invoiceNo: generateInvoiceNo(),
    amount: cleanAmount,
    invoiceDate: date || Date.now(),
    reason,
    note,
    billUrl,
    status: 'pending',
    planId: plan._id,
    projectName: plan.projectName,
  });
  await contractor.save();

  return {
    message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.',
    contractor,
  };
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// invoice record and flips its status to 'paid'.
const payInvoice = async (id, paymentId, { date, referenceNo, accountNumber, bankName, bankBranch, note }, files) => {
  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const invoice = contractor.payments.id(paymentId);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (invoice.status === 'paid') {
    throw new ApiError(400, 'This invoice has already been paid');
  }

  if (!referenceNo || !referenceNo.trim()) {
    throw new ApiError(400, 'referenceNo is required to record the payment');
  }

  const slipUrl = files?.slip?.[0]?.path;

  invoice.status = 'paid';
  invoice.paymentDate = date || Date.now();
  invoice.referenceNo = referenceNo;
  invoice.accountNumber = accountNumber || contractor.accountNumber;
  invoice.bankName = bankName || contractor.bankName;
  invoice.bankBranch = bankBranch || contractor.bankBranch;
  if (slipUrl) invoice.slipUrl = slipUrl;
  invoice.paymentNote = note;

  await contractor.save();

  return { message: 'Payment recorded - invoice marked as paid', contractor };
};

// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (amount, reason, invoice date,
// note) and, if the invoice has already been paid, also correct the
// payment-side details (reference no, bank info, payment date, note).
const updateInvoice = async (id, paymentId, body) => {
  const {
    amount, reason, date, note,
    referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
  } = body;

  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const invoice = contractor.payments.id(paymentId);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (amount !== undefined && amount !== '') invoice.amount = validateAmount(amount);
  if (reason !== undefined) invoice.reason = reason;
  if (date) invoice.invoiceDate = date;
  if (note !== undefined) invoice.note = note;

  if (invoice.status === 'paid') {
    if (referenceNo !== undefined) invoice.referenceNo = referenceNo;
    if (accountNumber !== undefined) invoice.accountNumber = accountNumber;
    if (bankName !== undefined) invoice.bankName = bankName;
    if (bankBranch !== undefined) invoice.bankBranch = bankBranch;
    if (paymentDate) invoice.paymentDate = paymentDate;
    if (paymentNote !== undefined) invoice.paymentNote = paymentNote;
  }

  // backfill invoiceNo if this is still a legacy record missing it
  if (!invoice.invoiceNo) {
    invoice.invoiceNo = generateInvoiceNo();
  }

  await contractor.save({ validateModifiedOnly: true });

  return { message: 'Invoice updated successfully', contractor };
};

const deletePayment = async (id, paymentId) => {
  const contractor = await findOrFail(Contractor, id, 'Contractor not found');

  const invoice = contractor.payments.id(paymentId);
  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  invoice.deleteOne();
  await contractor.save();

  return { message: 'Invoice deleted successfully', contractor };
};

module.exports = {
  getContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  addEstimationPlan,
  updateEstimationPlan,
  deleteEstimationPlan,
  createInvoice,
  updateInvoice,
  payInvoice,
  deletePayment,
};