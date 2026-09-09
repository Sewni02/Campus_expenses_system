const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getHardware,
  createHardware,
  addItem,
  updateItem,
  deleteItem,
  placeOrder,
  addPayment,
  getQuote,
} = require('../controllers/hardware.controller');

router.get('/', getHardware);
router.post('/', createHardware);
router.post('/quote', getQuote);
router.post('/:id/items', addItem);
router.put('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);
router.post('/:id/order', placeOrder);
router.post(
  '/:id/payments',
  upload.fields([{ name: 'bill', maxCount: 1 }, { name: 'slip', maxCount: 1 }]),
  addPayment
);

module.exports = router;