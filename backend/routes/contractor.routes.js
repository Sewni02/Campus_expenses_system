const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requireFinanceAccess } = require('../middleware/permission.middleware');
const {
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
} = require('../controllers/contractor.controller');

router.use(protect, requireApproved, requireFinanceAccess);

router.get('/', getContractors);
router.post('/', createContractor);
router.put('/:id', updateContractor);
router.delete('/:id', deleteContractor);

router.post(
  '/:id/plans',
  upload.fields([{ name: 'plan', maxCount: 1 }]),
  addEstimationPlan
);
// Edit an existing estimation plan — text fields only, optional re-upload
router.put(
  '/:id/plans/:planId',
  upload.fields([{ name: 'plan', maxCount: 1 }]),
  updateEstimationPlan
);
router.delete('/:id/plans/:planId', deleteEstimationPlan);

// Step 1: raise an invoice (bill from the contractor) against an estimation plan
router.post(
  '/:id/payments',
  upload.fields([{ name: 'bill', maxCount: 1 }]),
  createInvoice
);

// Edit an existing invoice (pending or paid) — text fields only, no re-upload
router.put('/:id/payments/:paymentId', updateInvoice);

// Step 2: record the bank payment made against a pending invoice
router.put(
  '/:id/payments/:paymentId/pay',
  upload.fields([{ name: 'slip', maxCount: 1 }]),
  payInvoice
);

router.delete('/:id/payments/:paymentId', deletePayment);

module.exports = router;