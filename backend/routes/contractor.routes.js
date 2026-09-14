const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const {
  getContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  addEstimationPlan,
  deleteEstimationPlan,
  addPayment,
} = require('../controllers/contractor.controller');

router.use(protect, requireApproved);

router.get('/', getContractors);
router.post('/', createContractor);
router.put('/:id', updateContractor);
router.delete('/:id', deleteContractor);

router.post(
  '/:id/plans',
  upload.fields([{ name: 'plan', maxCount: 1 }]),
  addEstimationPlan
);
router.delete('/:id/plans/:planId', deleteEstimationPlan);

router.post(
  '/:id/payments',
  upload.fields([{ name: 'slip', maxCount: 1 }, { name: 'bill', maxCount: 1 }]),
  addPayment
);

module.exports = router;