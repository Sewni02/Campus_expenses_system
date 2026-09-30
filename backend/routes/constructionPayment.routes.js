const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requireFinanceAccess } = require('../middleware/permission.middleware');
const { getPayments, createInvoice, payInvoice, updateInvoice, deletePayment } = require('../controllers/constructionPayment.controller');

router.use(protect, requireApproved, requireFinanceAccess);

router.get('/', getPayments);

// Step 1: raise an invoice (bill for this construction payment)
router.post('/', upload.single('bill'), createInvoice);

// Edit an existing invoice (pending or paid) — text fields only, no re-upload
router.put('/:id', updateInvoice);

// Step 2: record the bank payment made against a pending invoice
router.put('/:id/pay', upload.single('slip'), payInvoice);

router.delete('/:id', deletePayment);

module.exports = router;