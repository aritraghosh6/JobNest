const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const EmailOtp = require("../models/EmailOtp");
const PasswordReset = require("../models/PasswordReset");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { PUBLIC_ROLES, ROLES } = require("../config/constants");
const { BLOCKED_CODE, MESSAGES, isEmailBlocked } = require("../services/accountStatus");

// One email can hold one account per role (e.g. a job seeker account AND an employer account)
const ROLE_LABELS = { job_seeker: "job seeker", employer: "employer", admin: "administrator" };
const roleLabel = (role) => ROLE_LABELS[role] || role;
const TAB_LABELS = { job_seeker: "Job seeker", employer: "Employer" }; // the login page's tabs
const withArticle = (role) => `${/^[aeiou]/i.test(roleLabel(role)) ? "an" : "a"} ${roleLabel(role)}`;
/** Stops sign-up, login and password reset for an email the administrator has deactivated. */
const blockedError = (kind) => new AppError(403, MESSAGES[kind], { code: BLOCKED_CODE, email: MESSAGES[kind] });

const accountExistsMessage = (role) =>
  `You already have a ${roleLabel(role)} account with this email. Please log in instead.`;
const { checkEmail } = require("../services/emailCheck");
const { sendSignupOtp: sendOtpEmail, sendPasswordResetCode } = require("../services/mailService");
const {
  isEmail,
  isStrongPassword,
  cleanString,
  throwIfErrors,
} = require("../utils/validators");

// Sign-up verification code settings
const OTP_MINUTES = 10; // code is valid for 10 minutes
const OTP_RESEND_SECONDS = 60; // wait 60 seconds before asking for a new code
const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
  assessment_completed: user.assessment_completed,
  profile_completed: user.profile_completed,
  createdAt: user.createdAt,
});

/** Only a keyed hash of the code is stored, so a database leak does not reveal codes. */
const hashOtp = (email, code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${email}:${code}`).digest("hex");

const sameHash = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Validates name, email, password and role. Used by both sign-up steps. */
function readSignupBody(body) {
  const name = cleanString(body.name, 100);
  const email = cleanString(body.email, 150)?.toLowerCase();
  const { password, role } = body;

  const errors = {};
  if (!name) errors.name = "Name is required.";
  if (!email || !isEmail(email))
    errors.email = "Please enter a valid email address.";
  if (!isStrongPassword(password))
    errors.password =
      "Password must be at least 8 characters and include a letter and a number.";
  // Admin accounts can never be created through public sign-up
  if (!PUBLIC_ROLES.includes(role))
    errors.role = "Please choose either job seeker or employer.";
  throwIfErrors(errors);

  return { name, email, password, role };
}

// POST /api/v1/auth/signup/send-otp
// Step 1: checks the details and emails a 6-digit code. No account is created yet.
const sendSignupOtp = asyncHandler(async (req, res) => {
  const { name, email, role } = readSignupBody(req.body);

  // A deactivated email can't be used for a new account of either type
  if (await isEmailBlocked(email)) throw blockedError("signup");

  // The same email may already be used for the OTHER role; that is allowed
  if (await User.exists({ email, role }))
    throw new AppError(409, accountExistsMessage(role), { email: accountExistsMessage(role) });

  // The code is only sent if the address looks real and its domain can receive email
  const check = await checkEmail(email);
  if (!check.ok) throw new AppError(400, check.message, { email: check.message });

  const existing = await EmailOtp.findOne({ email });
  if (existing) {
    const waited = (Date.now() - existing.last_sent_at.getTime()) / 1000;
    if (waited < OTP_RESEND_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
      throw new AppError(429, `Please wait ${wait} seconds before requesting a new code.`, {
        retry_after: wait,
      });
    }
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await EmailOtp.findOneAndUpdate(
    { email },
    {
      code_hash: hashOtp(email, code),
      attempts: 0,
      last_sent_at: new Date(),
      expires_at: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const delivery = await sendOtpEmail({ to: email, name, code, minutes: OTP_MINUTES });
  if (delivery === "failed") {
    await EmailOtp.deleteOne({ email });
    throw new AppError(502, "We could not send the verification email. Please try again in a moment.");
  }

  res.json({
    message: `We sent a 6-digit code to ${email}.`,
    email,
    expires_in: OTP_MINUTES * 60,
    resend_after: OTP_RESEND_SECONDS,
    delivery, // "sent", or "logged" when SMTP is not set up (code is printed in the backend terminal)
    email_type: check.type, // "company" or "personal"
  });
});

// POST /api/v1/auth/signup
// Step 2: checks the code and creates the account.
const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = readSignupBody(req.body);
  if (await isEmailBlocked(email)) throw blockedError("signup");
  const otp = String(req.body.otp || "").trim();
  if (!/^\d{6}$/.test(otp))
    throw new AppError(400, "Please enter the 6-digit code from your email.", {
      otp: "Enter the 6-digit code.",
    });

  if (await User.exists({ email, role }))
    throw new AppError(409, accountExistsMessage(role), { email: accountExistsMessage(role) });

  const record = await EmailOtp.findOne({ email });
  if (!record || record.expires_at < new Date())
    throw new AppError(400, "This code has expired. Please request a new one.", {
      otp: "Code expired.",
    });
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    throw new AppError(429, "Too many wrong attempts. Please request a new code.", {
      otp: "Request a new code.",
    });
  }
  if (!sameHash(record.code_hash, hashOtp(email, otp))) {
    await EmailOtp.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    const left = OTP_MAX_ATTEMPTS - record.attempts - 1;
    const message =
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many wrong attempts. Please request a new code.";
    throw new AppError(400, message, { otp: message });
  }

  await record.deleteOne();
  const user = await User.create({ name, email, password, role });
  res.status(201).json({
    message: "User created successfully",
    token: signToken(user),
    user: publicUser(user),
  });
});

// POST /api/v1/auth/login   body: { email, password, role? }
// The login page sends the tab the user picked (job_seeker or employer). An administrator
// account can log in from either tab. One email can have a job seeker AND an employer account;
// if no role is sent and the password opens both, the reply asks the page to choose (409 CHOOSE_ROLE).
const login = asyncHandler(async (req, res) => {
  const email = cleanString(req.body.email, 150)?.toLowerCase();
  const { password } = req.body;
  if (!email || !password)
    throw new AppError(400, "Email and password are required.");

  const role = req.body.role ? String(req.body.role) : "";
  if (role && !Object.values(ROLES).includes(role))
    throw new AppError(400, "Unknown account type.");

  const accounts = await User.find(
    role ? { email, role: { $in: [role, ROLES.ADMIN] } } : { email }
  ).select("+password");
  const matches = [];
  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    if (await account.comparePassword(String(password))) matches.push(account);
  }

  if (!matches.length && role) {
    // Right email and password, wrong tab? Say so (only after the password is proven correct)
    const others = await User.find({ email, role: { $nin: [role, ROLES.ADMIN] } }).select("+password");
    for (const other of others) {
      // eslint-disable-next-line no-await-in-loop
      if (await other.comparePassword(String(password))) {
        if (await isEmailBlocked(email)) throw blockedError("login");
        throw new AppError(
          401,
          `This email and password belong to ${withArticle(other.role)} account, not ${withArticle(role)} account. Choose "${TAB_LABELS[other.role]}" above to log in.`,
          { code: "WRONG_ROLE", role: other.role }
        );
      }
    }
  }

  // Same message for unknown email and wrong password, so accounts cannot be discovered
  if (!matches.length) throw new AppError(401, "Invalid credentials");

  // Checked only after the password is right, so this can't be used to probe emails.
  // If the admin deactivated either account on this email, neither the job seeker nor the
  // employer account can log in (an administrator account on the same email is not affected).
  if (await isEmailBlocked(email)) {
    for (let i = matches.length - 1; i >= 0; i -= 1) if (matches[i].role !== ROLES.ADMIN) matches.splice(i, 1);
    if (!matches.length) throw blockedError("login");
  }

  if (matches.length > 1) {
    throw new AppError(409, "This email has more than one JobNest account. Choose which one to open.", {
      code: "CHOOSE_ROLE",
      roles: matches.map((m) => m.role),
    });
  }

  const user = matches[0];
  if (!user.is_active) throw blockedError("login");

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/v1/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/**
 * Password reset works on ONE account: one email can have a job seeker and an employer
 * account, each with its own password. The page sends which one (role).
 */
function readResetRole(body) {
  const role = String(body.role || "");
  if (!Object.values(ROLES).includes(role))
    throw new AppError(400, "Please choose whether to reset your job seeker or employer password.", {
      role: "Choose job seeker or employer.",
    });
  return role;
}

// POST /api/v1/auth/forgot-password   body: { email, role }
// Emails a 6-digit reset code for that account. The reply is the same whether or not the
// account exists, so this page cannot be used to find out who has an account.
const forgotPassword = asyncHandler(async (req, res) => {
  const email = cleanString(req.body.email, 150)?.toLowerCase();
  if (!email || !isEmail(email))
    throw new AppError(400, "Please enter a valid email address.", { email: "Please enter a valid email address." });
  const role = readResetRole(req.body);

  const generic = {
    message: `If ${withArticle(role)} account exists for ${email}, we've sent a 6-digit code to it.`,
    email,
    role,
    expires_in: OTP_MINUTES * 60,
    resend_after: OTP_RESEND_SECONDS,
    // Lets the page explain where the code is while email sending is not set up (development)
    email_configured: Boolean(process.env.SMTP_HOST),
  };

  // A deactivated email gets a clear answer instead of a code that would never work
  if (await isEmailBlocked(email)) throw blockedError("reset");

  const existing = await PasswordReset.findOne({ email, role });
  if (existing) {
    const waited = (Date.now() - existing.last_sent_at.getTime()) / 1000;
    if (waited < OTP_RESEND_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
      throw new AppError(429, `Please wait ${wait} seconds before requesting a new code.`, { retry_after: wait });
    }
  }

  // Only the chosen account; the other account on this email keeps its own password
  const user = await User.findOne({ email, role, is_active: true });
  if (!user) return res.json(generic);

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await PasswordReset.findOneAndUpdate(
    { email, role },
    {
      code_hash: hashOtp(`reset:${role}:${email}`, code),
      attempts: 0,
      last_sent_at: new Date(),
      expires_at: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const delivery = await sendPasswordResetCode({
    to: email,
    name: user.name,
    code,
    minutes: OTP_MINUTES,
    account: role === ROLES.ADMIN ? "" : roleLabel(role),
  });
  if (delivery === "failed") {
    await PasswordReset.deleteOne({ email, role });
    throw new AppError(502, "We could not send the email right now. Please try again in a moment.");
  }
  res.json(generic);
});

// POST /api/v1/auth/reset-password   body: { email, role, otp, password }
const resetPassword = asyncHandler(async (req, res) => {
  const email = cleanString(req.body.email, 150)?.toLowerCase();
  const otp = String(req.body.otp || "").trim();
  const { password } = req.body;

  const errors = {};
  if (!email || !isEmail(email)) errors.email = "Please enter a valid email address.";
  if (!/^\d{6}$/.test(otp)) errors.otp = "Enter the 6-digit code from your email.";
  if (!isStrongPassword(password))
    errors.password = "Password must be at least 8 characters and include a letter and a number.";
  throwIfErrors(errors);
  const role = readResetRole(req.body);

  if (await isEmailBlocked(email)) {
    await PasswordReset.deleteMany({ email });
    throw blockedError("reset");
  }

  const record = await PasswordReset.findOne({ email, role });
  if (!record || record.expires_at < new Date())
    throw new AppError(400, "This code has expired. Please request a new one.", { otp: "Code expired." });
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await record.deleteOne();
    throw new AppError(429, "Too many wrong attempts. Please request a new code.", { otp: "Request a new code." });
  }
  if (!sameHash(record.code_hash, hashOtp(`reset:${role}:${email}`, otp))) {
    await PasswordReset.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    const left = OTP_MAX_ATTEMPTS - record.attempts - 1;
    const message =
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many wrong attempts. Please request a new code.";
    throw new AppError(400, message, { otp: message });
  }

  // Only this account changes; the other account on the same email keeps its password
  const user = await User.findOne({ email, role, is_active: true }).select("+password");
  if (!user) {
    await record.deleteOne();
    throw new AppError(400, "This account cannot be reset. Please contact the administrator.");
  }
  user.password = password;
  await user.save();
  await record.deleteOne();
  res.json({
    message: `Your ${roleLabel(role)} password has been reset. You can now log in with your new password.`,
  });
});

module.exports = { sendSignupOtp, signup, login, me, forgotPassword, resetPassword, publicUser };
