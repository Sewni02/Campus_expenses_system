const ConstructionPayment = require('../models/constructionPayment.model');

const getPayments = async (req, res) => {
  try {
    const payments = await ConstructionPayment.find().sort({ date: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generates a short, human-readable invoice number, e.g. CINV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `CINV-${timePart}-${randPart}`;
};

// STEP 1 of the invoice flow: raise an invoice for a general construction
// payment. Created with status 'pending' and only carries invoice-side
// details (title, amount, who it's paid to, the bill received). No
// payment/bank info exists yet - that only gets attached once finance
// actually pays it (see payInvoice below).
const createInvoice = async (req, res) => {
  try {
    const { title, amount, paidTo, description, date, projectName } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ message: 'title and amount are required' });
    }
    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ message: 'projectName is required' });
    }

    const billUrl = req.file ? req.file.path : undefined;

    const payment = await ConstructionPayment.create({
      invoiceNo: generateInvoiceNo(),
      title,
      amount,
      paidTo,
      description,
      date: date || Date.now(),
      billUrl,
      projectName,
      status: 'pending',
    });

    res.status(201).json({ message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// record and flips its status to 'paid'.
const payInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, referenceNo, accountNumber, bankName, bankBranch, note } = req.body;

    const payment = await ConstructionPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ message: 'This invoice has already been paid' });
    }

    if (!referenceNo || !referenceNo.trim()) {
      return res.status(400).json({ message: 'referenceNo is required to record the payment' });
    }

    const slipUrl = req.file ? req.file.path : undefined;

    payment.status = 'paid';
    payment.paymentDate = date || Date.now();
    payment.referenceNo = referenceNo;
    payment.accountNumber = accountNumber;
    payment.bankName = bankName;
    payment.bankBranch = bankBranch;
    if (slipUrl) payment.slipUrl = slipUrl;
    payment.paymentNote = note;

    await payment.save();

    res.json({ message: 'Payment recorded - invoice marked as paid', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (title, amount, paid to, project,
// date, description) and, if the invoice has already been paid, also
// correct the payment-side details (reference no, bank info, payment
// date, note).
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, amount, paidTo, description, date, projectName,
      referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
    } = req.body;

    const payment = await ConstructionPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (title !== undefined && title !== '') payment.title = title;
    if (amount !== undefined && amount !== '') payment.amount = amount;
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

    res.json({ message: 'Invoice updated successfully', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await ConstructionPayment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPayments, createInvoice, payInvoice, updateInvoice, deletePayment };