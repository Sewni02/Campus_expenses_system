const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const {
  getLocations,
  addLocation,
  addBillType,
  deleteLocation,
  deleteBillType,
  getExpenses,
  createExpense,
  markAsPaid,
  updateExpense,
  downloadBill,
  deleteExpense,
} = require('../controllers/officeExpense.controller');

router.use(protect, requireApproved);

router.get('/locations', getLocations);
router.post('/locations', addLocation);
router.post('/locations/:locationId/bill-types', addBillType);
router.delete('/locations/:locationId', deleteLocation);
router.delete('/locations/:locationId/bill-types/:billTypeId', deleteBillType);

router.get('/', getExpenses);
router.post('/', upload.single('bill'), createExpense);
router.put('/:id', upload.fields([{ name: 'bill', maxCount: 1 }, { name: 'slip', maxCount: 1 }]), updateExpense);
router.get('/:id/download', downloadBill);
router.patch('/:id/pay', upload.single('slip'), markAsPaid);
router.delete('/:id', deleteExpense);

module.exports = router;