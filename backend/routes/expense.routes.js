const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { getExpenses, createExpense } = require('../controllers/expense.controller');

router.use(protect, requireApproved);

router.get('/', getExpenses);
router.post('/', upload.single('bankSlip'), createExpense);

module.exports = router;