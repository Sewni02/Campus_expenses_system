const asyncHandler = require('../utils/asyncHandler');
const auditService = require('../services/audit.service');

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await auditService.listAuditLogs(req.query);
  res.json(result);
});

module.exports = { getAuditLogs };