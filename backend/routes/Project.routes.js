const express = require('express');
const router = express.Router();
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requireConstructionsAccess } = require('../middleware/permission.middleware');
const { getProjectSummary, listProjectNames } = require('../controllers/Project.controller');

router.use(protect, requireApproved, requireConstructionsAccess);

// NOTE: must come before '/:name/summary' so it isn't swallowed by that param route.
router.get('/', listProjectNames);
router.get('/:name/summary', getProjectSummary);

module.exports = router;