const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const EmployerProfile = require('../models/EmployerProfile');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, VERIFICATION_STATUSES } = require('../config/constants');
const { assertValidId, cleanString } = require('../utils/validators');
const { sendStoredFile } = require('../utils/files');
const { serializeEmployer } = require('./profileController');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/v1/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const [seekers, employers, openJobs, totalJobs, applications, pending] = await Promise.all([
    User.countDocuments({ role: ROLES.JOB_SEEKER }),
    User.countDocuments({ role: ROLES.EMPLOYER }),
    Job.countDocuments({ status: 'open', moderation_status: 'active' }),
    Job.countDocuments(),
    Application.countDocuments(),
    EmployerProfile.countDocuments({ 'verification.status': 'pending' }),
  ]);
  res.json({
    stats: {
      job_seekers: seekers,
      employers,
      open_jobs: openJobs,
      total_jobs: totalJobs,
      applications,
      pending_verifications: pending,
    },
  });
});

// GET /api/v1/admin/users?role=&q=
const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (Object.values(ROLES).includes(req.query.role)) filter.role = req.query.role;
  const q = cleanString(req.query.q, 60);
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }];
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ users });
});

// PATCH /api/v1/admin/users/:id/status   body: { is_active: boolean }
const setUserStatus = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'user id');
  if (typeof req.body.is_active !== 'boolean') throw new AppError(400, 'is_active must be true or false.');
  if (String(req.params.id) === String(req.user._id)) throw new AppError(400, 'You cannot deactivate your own account.');
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found.');
  if (user.role === ROLES.ADMIN) throw new AppError(403, 'Administrator accounts cannot be changed here.');
  // The same person may have a job seeker AND an employer account on this email:
  // deactivating (or activating) one applies to both, so they can't use the other one instead.
  const filter = { email: user.email, role: { $ne: ROLES.ADMIN } };
  await User.updateMany(filter, { is_active: req.body.is_active });
  const users = await User.find(filter);
  const updated = users.find((u) => String(u._id) === String(user._id)) || user;
  const both = users.length > 1 ? ' (job seeker and employer accounts on this email)' : '';
  res.json({ message: `${req.body.is_active ? 'User activated' : 'User deactivated'}${both}`, user: updated, users });
});

// GET /api/v1/admin/employers?status=pending
const listEmployers = asyncHandler(async (req, res) => {
  const filter = {};
  if (VERIFICATION_STATUSES.includes(req.query.status)) filter['verification.status'] = req.query.status;
  const profiles = await EmployerProfile.find(filter)
    .populate('user', 'name email is_active')
    .sort({ 'verification.submitted_at': -1, createdAt: -1 })
    .limit(200);
  res.json({
    employers: profiles.map((p) => ({ ...serializeEmployer(p, { isAdmin: true }), user: p.user })),
  });
});

// PATCH /api/v1/admin/employers/:id/verification   body: { status: "approved"|"rejected", note? }
const reviewEmployer = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'employer profile id');
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw new AppError(400, 'Status must be approved or rejected.');
  const note = cleanString(req.body.note, 500);
  if (status === 'rejected' && !note) {
    throw new AppError(400, 'Please give a reason so the employer knows what to fix.', { note: 'Reason is required.' });
  }
  const profile = await EmployerProfile.findById(req.params.id);
  if (!profile) throw new AppError(404, 'Employer profile not found.');
  if (profile.verification.status !== 'pending') throw new AppError(409, 'Only pending verifications can be reviewed.');

  profile.verification.status = status;
  profile.verification.review_note = note;
  profile.verification.reviewed_at = new Date();
  profile.verification.reviewed_by = req.user._id;
  await profile.save();
  res.json({ message: `Employer ${status}`, employer: serializeEmployer(profile, { isAdmin: true }) });
});

// GET /api/v1/admin/employers/:id/document
const downloadVerificationDocument = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'employer profile id');
  const profile = await EmployerProfile.findById(req.params.id);
  if (!profile) throw new AppError(404, 'Employer profile not found.');
  sendStoredFile(res, 'verification', profile.verification?.document);
});

// GET /api/v1/admin/jobs?moderation_status=
const listJobs = asyncHandler(async (req, res) => {
  const filter = {};
  if (['active', 'removed'].includes(req.query.moderation_status)) filter.moderation_status = req.query.moderation_status;
  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(300);
  res.json({ jobs });
});

// PATCH /api/v1/admin/jobs/:id/moderation   body: { moderation_status: "active"|"removed", note? }
const moderateJob = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'job id');
  const { moderation_status: status } = req.body;
  if (!['active', 'removed'].includes(status)) throw new AppError(400, 'moderation_status must be active or removed.');
  const note = cleanString(req.body.note, 500);
  if (status === 'removed' && !note) throw new AppError(400, 'Please give a reason for removing this job.', { note: 'Reason is required.' });
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError(404, 'Job not found.');
  job.moderation_status = status;
  job.moderation_note = status === 'removed' ? note : undefined;
  await job.save({ validateModifiedOnly: true });
  res.json({ message: status === 'removed' ? 'Job removed from listings' : 'Job restored', job });
});

module.exports = {
  getStats,
  listUsers,
  setUserStatus,
  listEmployers,
  reviewEmployer,
  downloadVerificationDocument,
  listJobs,
  moderateJob,
};
