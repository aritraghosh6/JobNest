/**
 * Creates (or resets) the administrator account. Admins can never sign up publicly.
 *
 * Usage (from the backend folder):
 *   npm run create-admin
 * Reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from backend/.env
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { isEmail, isStrongPassword } = require('../utils/validators');

async function main() {
  const name = process.env.ADMIN_NAME || 'JobNest Admin';
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!isEmail(email)) throw new Error('Set a valid ADMIN_EMAIL in backend/.env');
  if (!isStrongPassword(password)) throw new Error('ADMIN_PASSWORD must be at least 8 characters with a letter and a number');

  await connectDB();
  // One email can hold one account per role, so look only for the admin account
  let user = await User.findOne({ email, role: ROLES.ADMIN }).select('+password');
  if (!user) user = new User({ name, email, role: ROLES.ADMIN });
  user.name = name;
  user.password = password;
  user.is_active = true;
  await user.save();
  console.log(`Admin account ready: ${email}`);
}

main()
  .catch((err) => {
    console.error('Could not create admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
