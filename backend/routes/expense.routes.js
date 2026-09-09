const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { getExpenses, createExpense } = require('../controllers/expense.controller');

router.get('/', getExpenses);
router.post('/', upload.single('bankSlip'), createExpense);

module.exports = router;