const ConstructionPayment = require('../models/constructionPayment.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { validateAmount } = require('../utils/validators');

// Generates a short, human-readable invoice number, e.g. CINV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `CINV-${timePart}-${randPart}`;
};

const getPayments = async () => {
  return ConstructionPayment.find().sort({ date: -1 });
};

// STEP 1 of the invoice flow: raise an invoice for a general construction
// payment. Created with status 'pending' and only carries invoice-side
// details (title, amount, who it's paid to, the bill received). No
// payment/bank info exists yet - that only gets attached once finance
// actually pays it (see payInvoice below).
const createInvoice = async ({ title, amount, paidTo, description, date, projectName }, file) => {
  if (!title || !amount) {
    throw new ApiError(400, 'title and amount are required');
  }
  if (!projectName || !projectName.trim()) {
    throw new ApiError(400, 'projectName is required');
  }

  const cleanAmount = validateAmount(amount);

  const billUrl = file ? file.path : undefined;

  const payment = await ConstructionPayment.create({
    invoiceNo: generateInvoiceNo(),
    title,
    amount: cleanAmount,
    paidTo,
    description,
    date: date || Date.now(),
    billUrl,
    projectName,
    status: 'pending',
  });

  return {
    message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.',
    payment,
  };
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// record and flips its status to 'paid'.
const payInvoice = async (id, { date, referenceNo, accountNumber, bankName, bankBranch, note }, file) => {
  const payment = await findOrFail(ConstructionPayment, id, 'Payment not found');

  if (payment.status === 'paid') {
    throw new ApiError(400, 'This invoice has already been paid');
  }

  if (!referenceNo || !referenceNo.trim()) {
    throw new ApiError(400, 'referenceNo is required to record the payment');
  }

  const slipUrl = file ? file.path : undefined;

  payment.status = 'paid';
  payment.paymentDate = date || Date.now();
  payment.referenceNo = referenceNo;
  payment.accountNumber = accountNumber;
  payment.bankName = bankName;
  payment.bankBranch = bankBranch;
  if (slipUrl) payment.slipUrl = slipUrl;
  payment.paymentNote = note;

  await payment.save();

  return { message: 'Payment recorded - invoice marked as paid', payment };
};

// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (title, amount, paid to, project,
// date, description) and, if the invoice has already been paid, also
// correct the payment-side details (reference no, bank info, payment
// date, note).
const updateInvoice = async (id, body) => {
  const {
    title, amount, paidTo, description, date, projectName,
    referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
  } = body;

  const payment = await findOrFail(ConstructionPayment, id, 'Payment not found');

  if (title !== undefined && title !== '') payment.title = title;
  if (amount !== undefined && amount !== '') payment.amount = validateAmount(amount);
  if (paidTo !== undefined) payment.paidTo = paidTo;
  if (description !== undefined) payment.description = description;
  if (date) payment.date = date;
  if (projectName !== undefined && projectName !== '') payment.projectName = projectName;

  // A record with no status at all is legacy data from before this flow
  // existed, and is treated as already paid - same rule used everywhere
  // else this status is read.
  const isPaid = payment.status ? payment.status === 'paid' : true;
  if (isPaid) {
    if (referenceNo !== undefined) payment.referenceNo = referenceNo;
    if (accountNumber !== undefined) payment.accountNumber = accountNumber;
    if (bankName !== undefined) payment.bankName = bankName;
    if (bankBranch !== undefined) payment.bankBranch = bankBranch;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (paymentNote !== undefined) payment.paymentNote = paymentNote;
  }

  // backfill invoiceNo if this is still a legacy record missing it
  if (!payment.invoiceNo) {
    payment.invoiceNo = generateInvoiceNo();
  }

  await payment.save({ validateModifiedOnly: true });

  return { message: 'Invoice updated successfully', payment };
};

const deletePayment = async (id) => {
  const payment = await ConstructionPayment.findByIdAndDelete(id);

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  return { message: 'Payment deleted successfully' };
};

module.exports = { getPayments, createInvoice, payInvoice, updateInvoice, deletePayment };