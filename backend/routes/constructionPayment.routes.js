const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { getPayments, createPayment, deletePayment } = require('../controllers/constructionPayment.controller');

router.use(protect, requireApproved);

router.get('/', getPayments);
router.post('/', upload.single('bill'), createPayment);
router.delete('/:id', deletePayment);

module.exports = router;