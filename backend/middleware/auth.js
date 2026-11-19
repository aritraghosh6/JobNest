const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { BLOCKED_CODE, MESSAGES, isUserBlocked } = require('../services/accountStatus');

/** Requires a valid "Authorization: Bearer <token>" header and loads req.user. */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Please log in to continue.');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token. Please log in again.';
    throw new AppError(401, message);
  }

  const user = await User.findById(payload.id);
  if (!user) throw new AppError(401, 'This account no longer exists.');
  // Blocked if this account, or the other account on the same email, was deactivated by the admin
  if (await isUserBlocked(user)) throw new AppError(403, MESSAGES.session, { code: BLOCKED_CODE });

  req.user = user;
  next();
});

/** Allows only the listed roles. The role always comes from the database, never from the client. */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };

module.exports = { protect, authorize };
