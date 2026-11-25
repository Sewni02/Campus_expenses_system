const asyncHandler = require('../utils/asyncHandler');
const { getSystemOverview, getLandingSummary } = require('../services/publicOverview.service');

// GET /api/public/system-overview - no login needed (landing page).
const systemOverview = asyncHandler(async (req, res) => {
  res.json(await getSystemOverview());
});

// GET /api/public/landing-summary - this month + year-to-date totals (landing page, no login).
const landingSummary = asyncHandler(async (req, res) => {
  res.json(await getLandingSummary());
});

module.exports = { systemOverview, landingSummary };