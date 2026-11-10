const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, default: 'employee' },
  department: { type: String },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  permissions: {
    type: [String],
    default: [],
  },

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Login protection (see auth.service.js): after too many wrong passwords in
  // a row the account is locked until `lockUntil`.
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  // Set when the password is reset. Any login token issued BEFORE this moment
  // stops working (see auth.middleware.js), so a stolen session dies with the old password.
  passwordChangedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);