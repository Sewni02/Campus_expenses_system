const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user.model');
const transporter = require('../config/email');
const { ApiError } = require('../utils/ApiError');

// All auth business logic lives here. Controllers only translate
// HTTP <-> service calls; nothing in this file knows about req/res.

const signupUser = async ({ name, email, password, role, department, adminCode }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const isSuperAdmin = Boolean(adminCode) && adminCode === process.env.ADMIN_SIGNUP_CODE;

  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
    role: isSuperAdmin ? 'super_admin' : (role || 'employee'),
    department,
    status: isSuperAdmin ? 'approved' : 'pending',
    permissions: isSuperAdmin ? ['*'] : [],
  });

  return {
    message: isSuperAdmin
      ? 'Super Admin account created successfully'
      : 'User registered successfully. Waiting for admin approval.',
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    },
  };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, 'Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(400, 'Invalid email or password');
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
    },
  };
};

// Deliberately never reveals whether the email exists - always returns the
// same generic message, whether or not a reset email was actually sent.
const requestPasswordReset = async ({ email }) => {
  const genericMessage = { message: 'If that email is registered, a reset link has been sent.' };

  const user = await User.findOne({ email });
  if (!user) {
    return genericMessage;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  await transporter.sendMail({
    from: `"Campus Expense System" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below to set a new password. This link expires in 15 minutes.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  return genericMessage;
};

const resetPassword = async ({ token, password }) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Reset link is invalid or has expired');
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: 'Password has been reset successfully. You can now log in.' };
};

module.exports = { signupUser, loginUser, requestPasswordReset, resetPassword };