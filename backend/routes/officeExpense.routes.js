const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const {
  getLocations,
  addLocation,
  addBillType,
  getExpenses,
  createExpense,
  markAsPaid,
  updateExpense,
  deleteExpense,
} = require('../controllers/officeExpense.controller');

router.use(protect, requireApproved);

router.get('/locations', getLocations);
router.post('/locations', addLocation);
router.post('/locations/:locationId/bill-types', addBillType);

router.get('/', getExpenses);
router.post('/', upload.single('bill'), createExpense);
router.put('/:id', upload.single('bill'), updateExpense);
router.patch('/:id/pay', markAsPaid);
router.delete('/:id', deleteExpense);

module.exports = router;