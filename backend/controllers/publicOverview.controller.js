const asyncHandler = require('../utils/asyncHandler');
const { getSystemOverview } = require('../services/publicOverview.service');

// GET /api/public/system-overview - no login needed (landing page).
const systemOverview = asyncHandler(async (req, res) => {
  res.json(await getSystemOverview());
});

module.exports = { systemOverview };