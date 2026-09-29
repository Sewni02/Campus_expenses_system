const asyncHandler = require('../utils/asyncHandler');
const constructionPaymentService = require('../services/constructionPayment.service');

const getPayments = asyncHandler(async (req, res) => {
  const payments = await constructionPaymentService.getPayments();
  res.json(payments);
});

const createInvoice = asyncHandler(async (req, res) => {
  const result = await constructionPaymentService.createInvoice(req.body, req.file);
  res.status(201).json(result);
});

const payInvoice = asyncHandler(async (req, res) => {
  const result = await constructionPaymentService.payInvoice(req.params.id, req.body, req.file);
  res.json(result);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const result = await constructionPaymentService.updateInvoice(req.params.id, req.body);
  res.json(result);
});

const deletePayment = asyncHandler(async (req, res) => {
  const result = await constructionPaymentService.deletePayment(req.params.id);
  res.json(result);
});

module.exports = { getPayments, createInvoice, payInvoice, updateInvoice, deletePayment };