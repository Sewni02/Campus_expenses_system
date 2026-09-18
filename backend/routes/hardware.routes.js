const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
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
  deletePayment,
  confirmPayment,
  getQuote,
  createInvoice,
  updateInvoice,
  payInvoice,
  deleteInvoice,
} = require('../controllers/hardware.controller');

router.use(protect, requireApproved);

router.get('/', getHardware);
router.post('/', createHardware);
router.put('/:id', updateHardware);
router.delete('/:id', deleteHardware);
router.post('/quote', getQuote);
router.post('/:id/items', addItem);
router.put('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);
router.post('/:id/order', placeOrder);
router.post(
  '/:id/payments',
  upload.fields([{ name: 'bills', maxCount: 20 }, { name: 'bill', maxCount: 1 }, { name: 'slip', maxCount: 1 }]),
  addPayment
);
router.delete('/:id/payments/:paymentId', deletePayment);
router.put('/:id/payments/:paymentId/confirm', confirmPayment);

// Invoice flow (mirrors the contractor invoice flow) - raise an invoice
// against a hardware supplier for a project, then record the bank payment
// against it once finance settles it. Kept separate from the /payments
// routes above, which are the supplier's own direct bill+payment log.
router.post(
  '/:id/invoices',
  upload.fields([{ name: 'bill', maxCount: 1 }]),
  createInvoice
);
router.put('/:id/invoices/:invoiceId', updateInvoice);
router.put(
  '/:id/invoices/:invoiceId/pay',
  upload.fields([{ name: 'slip', maxCount: 1 }]),
  payInvoice
);
router.delete('/:id/invoices/:invoiceId', deleteInvoice);

module.exports = router;