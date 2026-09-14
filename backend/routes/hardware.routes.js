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
  getQuote,
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

module.exports = router;