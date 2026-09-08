const express = require('express');
const router = express.Router();
const {
  getHardware,
  createHardware,
  addItem,
  updateItem,
  deleteItem,
  placeOrder,
  getQuote,
} = require('../controllers/hardware.controller');

router.get('/', getHardware);
router.post('/', createHardware);
router.post('/quote', getQuote);
router.post('/:id/items', addItem);
router.put('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);
router.post('/:id/order', placeOrder);

module.exports = router;