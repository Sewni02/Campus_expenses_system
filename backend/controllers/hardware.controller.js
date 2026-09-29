const asyncHandler = require('../utils/asyncHandler');
const hardwareService = require('../services/hardware.service');

const getHardware = asyncHandler(async (req, res) => {
  const hardware = await hardwareService.getHardware();
  res.json(hardware);
});

const createHardware = asyncHandler(async (req, res) => {
  const result = await hardwareService.createHardware(req.body);
  res.status(201).json(result);
});

const updateHardware = asyncHandler(async (req, res) => {
  const result = await hardwareService.updateHardware(req.params.id, req.body);
  res.json(result);
});

const deleteHardware = asyncHandler(async (req, res) => {
  const result = await hardwareService.deleteHardware(req.params.id);
  res.json(result);
});

const addItem = asyncHandler(async (req, res) => {
  const result = await hardwareService.addItem(req.params.id, req.body);
  res.json(result);
});

const updateItem = asyncHandler(async (req, res) => {
  const result = await hardwareService.updateItem(req.params.id, req.params.itemId, req.body);
  res.json(result);
});

const deleteItem = asyncHandler(async (req, res) => {
  const result = await hardwareService.deleteItem(req.params.id, req.params.itemId);
  res.json(result);
});

const placeOrder = asyncHandler(async (req, res) => {
  const result = await hardwareService.placeOrder(req.params.id, req.body);
  res.json(result);
});

const addPayment = asyncHandler(async (req, res) => {
  const result = await hardwareService.addPayment(req.params.id, req.body, req.files);
  res.json(result);
});

const getQuote = asyncHandler(async (req, res) => {
  const result = await hardwareService.getQuote(req.body);
  res.json(result);
});

const updatePayment = asyncHandler(async (req, res) => {
  const result = await hardwareService.updatePayment(
    req.params.id, req.params.paymentId, req.body, req.files
  );
  res.json(result);
});

const deletePayment = asyncHandler(async (req, res) => {
  const result = await hardwareService.deletePayment(req.params.id, req.params.paymentId);
  res.json(result);
});

const confirmPayment = asyncHandler(async (req, res) => {
  const result = await hardwareService.confirmPayment(req.params.id, req.params.paymentId);
  res.json(result);
});

const createInvoice = asyncHandler(async (req, res) => {
  const result = await hardwareService.createInvoice(req.params.id, req.body, req.files);
  res.status(201).json(result);
});

const payInvoice = asyncHandler(async (req, res) => {
  const result = await hardwareService.payInvoice(
    req.params.id, req.params.invoiceId, req.body, req.files
  );
  res.json(result);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const result = await hardwareService.updateInvoice(
    req.params.id, req.params.invoiceId, req.body, req.files
  );
  res.json(result);
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const result = await hardwareService.deleteInvoice(req.params.id, req.params.invoiceId);
  res.json(result);
});

module.exports = {
  getHardware,
  createHardware,
  updateHardware,
  deleteHardware,
  addItem,
  updateItem,
  deleteItem,
  placeOrder,
  addPayment,
  updatePayment,
  deletePayment,
  confirmPayment,
  getQuote,
  createInvoice,
  updateInvoice,
  payInvoice,
  deleteInvoice,
};