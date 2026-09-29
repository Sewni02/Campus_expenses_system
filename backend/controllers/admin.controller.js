const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/admin.service');

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await adminService.listUsers();
  res.json(users);
});

const getUserStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getUserStats();
  res.json(stats);
});

const approveUser = asyncHandler(async (req, res) => {
  const result = await adminService.approveUser(req.params.id, req.body.permissions);
  res.json(result);
});

const rejectUser = asyncHandler(async (req, res) => {
  const result = await adminService.rejectUser(req.params.id);
  res.json(result);
});

module.exports = { getAllUsers, getUserStats, approveUser, rejectUser };