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
    const { name, phone, registrationDate } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }
    const contractor = await Contractor.create({ name, phone, registrationDate });
    res.status(201).json({ message: 'Contractor added successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateContractor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, registrationDate } = req.body;

    const contractor = await Contractor.findByIdAndUpdate(
      id,
      { name, phone, registrationDate },
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

// A payment is always recorded against one of the contractor's estimation
// plans, so we can tell which project it belongs to and roll it up later.
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, reason, note, paymentType, planId, referenceNo } = req.body;

    if (!amount) {
      return res.status(400).json({ message: 'amount is required' });
    }
    if (!planId) {
      return res.status(400).json({ message: 'planId is required - payments must be linked to an estimation plan' });
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

    const slipUrl = req.files?.slip?.[0]?.path;
    const billUrl = req.files?.bill?.[0]?.path;

    contractor.payments.push({
      amount,
      date: date || Date.now(),
      reason,
      note,
      paymentType: paymentType || 'direct_slip',
      slipUrl,
      billUrl,
      referenceNo,
      planId: plan._id,
      projectName: plan.projectName,
    });
    await contractor.save();

    res.json({ message: 'Payment added successfully', contractor });
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
  deleteEstimationPlan,
  addPayment,
};