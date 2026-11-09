const mongoose = require('mongoose');

// One employee profile. The basic salary lives here (and can be changed any time
// by editing the profile); the monthly salary form copies it when a salary is created.
const staffMemberSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffLocation', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Sri Lankan NIC: 9 digits + V/X (old format) or 12 digits (new format). Stored in capitals.
    nic: { type: String, required: true, trim: true, uppercase: true },
    // 10 digits starting with 0, e.g. 0771234567
    mobile: { type: String, required: true, trim: true },
    // The day they joined the company, stored at UTC midnight (read back in UTC so it never shifts a day).
    joinedDate: { type: Date, required: true },
    basicSalary: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// The same NIC cannot be added twice to the same location.
staffMemberSchema.index({ location: 1, nic: 1 }, { unique: true });

module.exports = mongoose.model('StaffMember', staffMemberSchema);