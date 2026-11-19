const User = require('../models/User');
const { ROLES } = require('../config/constants');

/**
 * One email can have a job seeker account AND an employer account.
 * When the administrator deactivates either of them, the whole email is blocked:
 * no login as job seeker or employer, no new sign-up, no password reset.
 * Administrator accounts are never blocked this way.
 */
const BLOCKED_CODE = 'ACCOUNT_DEACTIVATED';

const MESSAGES = {
  login:
    "This email address has been deactivated by the administrator, so you can't log in as a job seeker or an employer. Please contact the administrator.",
  signup:
    "This email address has been deactivated by the administrator, so it can't be used to register a new account. Please contact the administrator.",
  reset:
    "This email address has been deactivated by the administrator, so its password can't be reset. Please contact the administrator.",
  session: 'Your account has been deactivated by the administrator. Please contact the administrator.',
};

/** True when any job seeker or employer account using this email is deactivated. */
async function isEmailBlocked(email) {
  if (!email) return false;
  return Boolean(
    await User.exists({ email: String(email).toLowerCase().trim(), is_active: false, role: { $ne: ROLES.ADMIN } })
  );
}

/** True when this account, or any other account on the same email, is deactivated. */
async function isUserBlocked(user) {
  if (!user) return true;
  if (!user.is_active) return true;
  if (user.role === ROLES.ADMIN) return false;
  return isEmailBlocked(user.email);
}

module.exports = { BLOCKED_CODE, MESSAGES, isEmailBlocked, isUserBlocked };
