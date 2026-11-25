// One-off script: moves the super admin login to sewniransadi@gmail.com
// and sets a new password for it.
//
// Run from the backend folder:   node scripts/setSuperAdminCredentials.js
//
// - The new email is fixed below (NEW_EMAIL). Only the password is typed, and it
//   is hidden while typing and never saved in your shell history.
// - It connects to whatever MONGO_URI is in backend/.env. For the HOSTED site,
//   that .env must contain the hosted database's MONGO_URI.
// - The password is hashed exactly like the app does (bcrypt, 10 rounds) and must
//   follow the same rules as signup/reset (8+ chars, a letter and a number).
// - Old login sessions of this account stop working, and any lockout or pending
//   reset token is cleared.
// - If another (non super admin) account already uses NEW_EMAIL, the script shows
//   it and, only after you type MOVE, renames THAT account's email to a dead
//   placeholder address so NEW_EMAIL becomes free. Nothing is ever deleted.
require('dotenv').config();
const readline = require('readline');
const { Writable } = require('stream');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { validateEmail, validatePassword } = require('../utils/validators');
const { exactRegex } = require('../utils/escapeRegex');

const NEW_EMAIL = 'sewniransadi@gmail.com';

// readline whose echo can be switched off (for the password).
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    muted = hidden;
    rl.question('', (answer) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }
  const newEmail = validateEmail(NEW_EMAIL);

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\nConnected to database "${mongoose.connection.name}" on ${mongoose.connection.host}`);

  const admins = await User.find({ role: 'super_admin' }).select('name email');
  if (admins.length === 0) {
    throw new Error('No super admin found in this database. Check that MONGO_URI points to the right database.');
  }
  console.log('\nSuper admin account(s) in this database:');
  admins.forEach((a) => console.log(`  - ${a.email}  (${a.name})`));

  let target;
  if (admins.length === 1) {
    target = admins[0];
  } else {
    const current = (await ask('\nWhich one to change? Type its current email: ')).trim();
    target = admins.find((a) => a.email.toLowerCase() === current.toLowerCase());
    if (!target) throw new Error('That email is not one of the super admins listed above.');
  }

  const clash = await User.findOne({ email: exactRegex(newEmail), _id: { $ne: target._id } });
  if (clash && clash.role === 'super_admin') {
    throw new Error(`Another SUPER ADMIN (${clash.name}) already uses ${newEmail}. Nothing was changed.`);
  }
  if (clash) {
    console.log(`\n${newEmail} is already used by another account:`);
    console.log(`  name: ${clash.name} | role: ${clash.role} | status: ${clash.status} | created: ${clash.createdAt}`);
    console.log('To use this email for the super admin, that account\'s email has to be renamed first.');
    console.log('(It is NOT deleted - only its email changes, so nobody can log in with it any more.)');
  }

  const password = await ask(`\nNEW password for ${newEmail} (hidden): `, { hidden: true });
  validatePassword(password);
  const again = await ask('Type the NEW password again: ', { hidden: true });
  if (password !== again) throw new Error('The two passwords did not match. Nothing was changed.');

  console.log(`\nAbout to change the super admin login:\n  ${target.email}  ->  ${newEmail}\n  password: will be replaced`);
  const renamedEmail = clash ? `${clash.name.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user'}-renamed-${String(clash._id).slice(-6)}@removed.invalid` : null;
  if (clash) console.log(`  other account "${clash.name}": email ${clash.email}  ->  ${renamedEmail}`);
  console.log('');
  const confirm = (await ask(clash ? 'Type MOVE to apply: ' : 'Type YES to apply: ')).trim();
  if (confirm !== (clash ? 'MOVE' : 'YES')) {
    console.log('Cancelled. Nothing was changed.');
    return;
  }

  if (clash) {
    await User.updateOne({ _id: clash._id }, { $set: { email: renamedEmail } });
  }

  const user = await User.findById(target._id);
  user.email = newEmail;
  user.password = await bcrypt.hash(password, 10);
  user.passwordChangedAt = new Date(); // old login sessions stop working
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.status = 'approved';
  await user.save();

  console.log(`\nDone. Log in with ${newEmail} and the new password.`);
}

run()
  .catch((err) => {
    console.error(`\nError: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await mongoose.disconnect();
  });