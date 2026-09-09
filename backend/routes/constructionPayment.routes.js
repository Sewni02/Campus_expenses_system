const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { getPayments, createPayment } = require('../controllers/constructionPayment.controller');

router.get('/', getPayments);
router.post('/', upload.single('bill'), createPayment);

module.exports = router;