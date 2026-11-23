const asyncHandler = require('../utils/asyncHandler');
const { getGrandTotals } = require('../services/grandTotal.service');

// GET /api/grand-total?month=2026-10 (month is optional)
const grandTotals = asyncHandler(async (req, res) => {
  res.json(await getGrandTotals({ month: req.query.month }));
});

module.exports = { grandTotals };