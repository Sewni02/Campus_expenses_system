const asyncHandler = require('../utils/asyncHandler');
const projectService = require('../services/project.service');

const listProjectNames = asyncHandler(async (req, res) => {
  const result = await projectService.listProjectNames();
  res.json(result);
});

const getProjectSummary = asyncHandler(async (req, res) => {
  const result = await projectService.getProjectSummary(req.params.name);
  res.json(result);
});

module.exports = { getProjectSummary, listProjectNames };