const Contractor = require('../models/contractor.model');

const getContractors = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search ? { name: new RegExp(search, 'i') } : {};
    const contractors = await Contractor.find(filter).sort({ createdAt: -1 });
    res.json(contractors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createContractor = async (req, res) => {
  try {
    const { name, phone, registrationDate, accountNumber, bankName, bankBranch } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }
    const contractor = await Contractor.create({ name, phone, registrationDate, accountNumber, bankName, bankBranch });
    res.status(201).json({ message: 'Contractor added successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateContractor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, registrationDate, accountNumber, bankName, bankBranch } = req.body;

    const contractor = await Contractor.findByIdAndUpdate(
      id,
      { name, phone, registrationDate, accountNumber, bankName, bankBranch },
      { new: true, runValidators: true }
    );

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    res.json({ message: 'Contractor updated successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteContractor = async (req, res) => {
  try {
    const { id } = req.params;
    const contractor = await Contractor.findByIdAndDelete(id);

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    res.json({ message: 'Contractor deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add an estimation plan a contractor has submitted for a project.
// A single contractor can have many plans, and many contractors can
// each have a plan against the same projectName.
const addEstimationPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { projectName, totalEstimate, note } = req.body;

    if (!projectName || !totalEstimate) {
      return res.status(400).json({ message: 'projectName and totalEstimate are required' });
    }

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const planFileUrl = req.files?.plan?.[0]?.path;

    contractor.estimationPlans.push({
      projectName,
      totalEstimate,
      note,
      planFileUrl,
    });
    await contractor.save();

    res.json({ message: 'Estimation plan added successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateEstimationPlan = async (req, res) => {
  try {
    const { id, planId } = req.params;
    const { projectName, totalEstimate, note } = req.body;

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const plan = contractor.estimationPlans.id(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Estimation plan not found' });
    }

    if (projectName !== undefined) plan.projectName = projectName;
    if (totalEstimate !== undefined && totalEstimate !== '') plan.totalEstimate = totalEstimate;
    if (note !== undefined) plan.note = note;

    const planFileUrl = req.files?.plan?.[0]?.path;
    if (planFileUrl) plan.planFileUrl = planFileUrl;

    await contractor.save({ validateModifiedOnly: true });

    res.json({ message: 'Estimation plan updated successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteEstimationPlan = async (req, res) => {
  try {
    const { id, planId } = req.params;

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const plan = contractor.estimationPlans.id(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Estimation plan not found' });
    }

    plan.deleteOne();
    await contractor.save();

    res.json({ message: 'Estimation plan deleted successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generates a short, human-readable invoice number, e.g. INV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `INV-${timePart}-${randPart}`;
};

// STEP 1 of the invoice flow: raise an invoice against one of the
// contractor's estimation plans. This is created with status 'pending' and
// only carries invoice-side details (amount, reason, the bill file received
// from the contractor). No payment/bank info exists yet - that only gets
// attached once finance actually pays it (see payInvoice below).
const createInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, reason, note, planId } = req.body;

    if (!amount) {
      return res.status(400).json({ message: 'amount is required' });
    }
    if (!planId) {
      return res.status(400).json({ message: 'planId is required - invoices must be linked to an estimation plan' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const plan = contractor.estimationPlans.id(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Estimation plan not found for this contractor' });
    }

    const billUrl = req.files?.bill?.[0]?.path;

    contractor.payments.push({
      invoiceNo: generateInvoiceNo(),
      amount,
      invoiceDate: date || Date.now(),
      reason,
      note,
      billUrl,
      status: 'pending',
      planId: plan._id,
      projectName: plan.projectName,
    });
    await contractor.save();

    res.status(201).json({ message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// invoice record and flips its status to 'paid'.
const payInvoice = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { date, referenceNo, accountNumber, bankName, bankBranch, note } = req.body;

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const invoice = contractor.payments.id(paymentId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'This invoice has already been paid' });
    }

    if (!referenceNo || !referenceNo.trim()) {
      return res.status(400).json({ message: 'referenceNo is required to record the payment' });
    }

    const slipUrl = req.files?.slip?.[0]?.path;

    invoice.status = 'paid';
    invoice.paymentDate = date || Date.now();
    invoice.referenceNo = referenceNo;
    invoice.accountNumber = accountNumber || contractor.accountNumber;
    invoice.bankName = bankName || contractor.bankName;
    invoice.bankBranch = bankBranch || contractor.bankBranch;
    if (slipUrl) invoice.slipUrl = slipUrl;
    invoice.paymentNote = note;

    await contractor.save();

    res.json({ message: 'Payment recorded - invoice marked as paid', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (amount, reason, invoice date,
// note) and, if the invoice has already been paid, also correct the
// payment-side details (reference no, bank info, payment date, note).
const updateInvoice = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const {
      amount, reason, date, note,
      referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
    } = req.body;

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const invoice = contractor.payments.id(paymentId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (amount !== undefined && amount !== '') invoice.amount = amount;
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

    res.json({ message: 'Invoice updated successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


const deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const invoice = contractor.payments.id(paymentId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    invoice.deleteOne();
    await contractor.save();

    res.json({ message: 'Invoice deleted successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
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