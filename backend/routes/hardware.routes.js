const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requireFinanceAccess, requireFinanceRead } = require('../middleware/permission.middleware');
const {
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
} = require('../controllers/hardware.controller');

router.use(protect, requireApproved);

// The price finder is a POST but only READS data, so it needs a read permission
// (any finance permission), not 'add'. It must stay ABOVE the guard below.
router.post('/quote', requireFinanceRead, getQuote);

// Everything below is guarded by HTTP method: GET -> read, POST -> add,
// PUT/PATCH -> edit, DELETE -> delete (see middleware/permission.middleware.js).
router.use(requireFinanceAccess);

router.get('/', getHardware);
router.post('/', createHardware);
router.put('/:id', updateHardware);
router.delete('/:id', deleteHardware);
router.post('/:id/items', addItem);
router.put('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);
router.post('/:id/order', placeOrder);
router.post(
  '/:id/payments',
  upload.fields([{ name: 'bills', maxCount: 20 }, { name: 'bill', maxCount: 1 }, { name: 'slip', maxCount: 1 }]),
  addPayment
);
// Edit an existing direct bill+payment record — text fields, optional re-upload
router.put(
  '/:id/payments/:paymentId',
  upload.fields([{ name: 'bills', maxCount: 20 }, { name: 'bill', maxCount: 1 }, { name: 'slip', maxCount: 1 }]),
  updatePayment
);
router.delete('/:id/payments/:paymentId', deletePayment);
router.put('/:id/payments/:paymentId/confirm', confirmPayment);

// Invoice flow (mirrors the contractor invoice flow) - raise an invoice
// against a hardware supplier for a project, then record the bank payment
// against it once finance settles it. Kept separate from the /payments
// routes above, which are the supplier's own direct bill+payment log.
router.post(
  '/:id/invoices',
  upload.fields([{ name: 'bills', maxCount: 20 }, { name: 'bill', maxCount: 1 }]),
  createInvoice
);
router.put(
  '/:id/invoices/:invoiceId',
  upload.fields([{ name: 'bills', maxCount: 20 }, { name: 'bill', maxCount: 1 }]),
  updateInvoice
);
router.put(
  '/:id/invoices/:invoiceId/pay',
  upload.fields([{ name: 'slip', maxCount: 1 }]),
  payInvoice
);
router.delete('/:id/invoices/:invoiceId', deleteInvoice);

module.exports = router;