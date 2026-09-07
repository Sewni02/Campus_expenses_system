const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  addPayment,
} = require('../controllers/contractor.controller');

router.get('/', getContractors);
router.post('/', createContractor);
router.put('/:id', updateContractor);
router.delete('/:id', deleteContractor);
router.post(
  '/:id/payments',
  upload.fields([{ name: 'slip', maxCount: 1 }, { name: 'bill', maxCount: 1 }]),
  addPayment
);

module.exports = router;