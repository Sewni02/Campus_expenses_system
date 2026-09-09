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

const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, note, paymentType } = req.body;

    if (!amount) {
      return res.status(400).json({ message: 'amount is required' });
    }

    const contractor = await Contractor.findById(id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const slipUrl = req.files?.slip?.[0]?.path;
    const billUrl = req.files?.bill?.[0]?.path;

    contractor.payments.push({
      amount,
      date: date || Date.now(),
      note,
      paymentType: paymentType || 'direct_slip',
      slipUrl,
      billUrl,
    });
    await contractor.save();

    res.json({ message: 'Payment added successfully', contractor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getContractors, createContractor, updateContractor, deleteContractor, addPayment };