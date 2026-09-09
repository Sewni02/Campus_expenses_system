const express = require('express');
const router = express.Router();
const { getProjectSummary, listProjectNames } = require('../controllers/Project.controller');

// NOTE: must come before '/:name/summary' so it isn't swallowed by that param route.
router.get('/', listProjectNames);
router.get('/:name/summary', getProjectSummary);

module.exports = router;