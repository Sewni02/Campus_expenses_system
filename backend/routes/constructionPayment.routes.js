const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { getPayments, createPayment, deletePayment } = require('../controllers/constructionPayment.controller');

router.get('/', getPayments);
router.post('/', upload.single('bill'), createPayment);
router.delete('/:id', deletePayment);

module.exports = router;