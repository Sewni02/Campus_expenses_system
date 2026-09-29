const asyncHandler = require('../utils/asyncHandler');
const contractorService = require('../services/contractor.service');

const getContractors = asyncHandler(async (req, res) => {
  const contractors = await contractorService.getContractors(req.query);
  res.json(contractors);
});

const createContractor = asyncHandler(async (req, res) => {
  const result = await contractorService.createContractor(req.body);
  res.status(201).json(result);
});

const updateContractor = asyncHandler(async (req, res) => {
  const result = await contractorService.updateContractor(req.params.id, req.body);
  res.json(result);
});

const deleteContractor = asyncHandler(async (req, res) => {
  const result = await contractorService.deleteContractor(req.params.id);
  res.json(result);
});

const addEstimationPlan = asyncHandler(async (req, res) => {
  const result = await contractorService.addEstimationPlan(req.params.id, req.body, req.files);
  res.json(result);
});

const updateEstimationPlan = asyncHandler(async (req, res) => {
  const result = await contractorService.updateEstimationPlan(
    req.params.id, req.params.planId, req.body, req.files
  );
  res.json(result);
});

const deleteEstimationPlan = asyncHandler(async (req, res) => {
  const result = await contractorService.deleteEstimationPlan(req.params.id, req.params.planId);
  res.json(result);
});

const createInvoice = asyncHandler(async (req, res) => {
  const result = await contractorService.createInvoice(req.params.id, req.body, req.files);
  res.status(201).json(result);
});

const payInvoice = asyncHandler(async (req, res) => {
  const result = await contractorService.payInvoice(
    req.params.id, req.params.paymentId, req.body, req.files
  );
  res.json(result);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const result = await contractorService.updateInvoice(req.params.id, req.params.paymentId, req.body);
  res.json(result);
});

const deletePayment = asyncHandler(async (req, res) => {
  const result = await contractorService.deletePayment(req.params.id, req.params.paymentId);
  res.json(result);
});

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