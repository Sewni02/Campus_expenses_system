const User = require('../models/user.model');
const { ApiError } = require('../utils/ApiError');

const listUsers = async () => {
  return User.find().select('-password');
};

const getUserStats = async () => {
  const [total, approved, rejected] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'approved' }),
    User.countDocuments({ status: 'rejected' }),
  ]);
  return { total, approved, rejected };
};

const approveUser = async (id, permissions) => {
  const user = await User.findByIdAndUpdate(
    id,
    { status: 'approved', permissions: permissions || [] },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return { message: 'User permissions saved successfully', user };
};

const rejectUser = async (id) => {
  const user = await User.findByIdAndUpdate(
    id,
    { status: 'rejected', permissions: [] },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return { message: 'User rejected', user };
};

module.exports = { listUsers, getUserStats, approveUser, rejectUser };