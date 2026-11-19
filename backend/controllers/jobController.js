const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const Job = require('../models/Job');
const Application = require('../models/Application');
const EmployerProfile = require('../models/EmployerProfile');
const SeekerProfile = require('../models/SeekerProfile');
const SavedJob = require('../models/SavedJob');
const Follow = require('../models/Follow');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { companyUserIds } = require('../services/companyGroup');
const { deadlineEndOfDay } = require('../utils/deadline');

// Withdrawn applications don't count towards the applicant total or the applicant limit
const ACTIVE_APPLICATION = { status: { $ne: 'withdrawn' } };
const countActive = (jobId) => Application.countDocuments({ job: jobId, ...ACTIVE_APPLICATION });
const { CULTURE_TAGS, EMPLOYMENT_TYPES, ROLES, ACTIVE_APPLICATION_STATUSES } = require('../config/constants');
const { requireEmployerVerification } = require('../config/env');
const { cleanString, toStringArray, toNumber, throwIfErrors, assertValidId } = require('../utils/validators');
const { computeMatch } = require('../services/matchingService');
const { loadSeekerContext } = require('../services/seekerContext');
const { sendApplicationConfirmation } = require('../services/mailService');
const { storedPath } = require('../utils/files');
const { notify, statusMessage } = require('../services/notificationService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Jobs that seekers are allowed to see
const visibleJobFilter = () => ({
  status: 'open',
  moderation_status: 'active',
  $or: [{ application_deadline: null }, { application_deadline: { $gte: new Date() } }],
});

function buildJobData(body, { isCreate }) {
  const errors = {};
  const data = {
    title: cleanString(body.title, 120),
    description: cleanString(body.description, 5000),
    skills_required: toStringArray(body.skills_required, 30, 50),
    qualifications: cleanString(body.qualifications, 1000),
    experience_min: toNumber(body.experience_min) ?? 0,
    location: cleanString(body.location, 100),
    employment_type: body.employment_type,
    is_remote: Boolean(body.is_remote),
    salary_min: toNumber(body.salary_min),
    salary_max: toNumber(body.salary_max),
    culture_tags: toStringArray(body.culture_tags, 5).filter((t) => CULTURE_TAGS.includes(t)),
    // Open until the END of the chosen day, not its first minute
    application_deadline: deadlineEndOfDay(body.application_deadline),
    max_applicants: body.max_applicants === '' || body.max_applicants === null ? undefined : toNumber(body.max_applicants),
  };

  if (!data.title) errors.title = 'Job title is required.';
  if (!data.description || data.description.length < 50) errors.description = 'Job description must be at least 50 characters.';
  if (!data.skills_required.length) errors.skills_required = 'Add at least one required skill.';
  if (!data.location) errors.location = 'Location is required.';
  if (!EMPLOYMENT_TYPES.includes(data.employment_type)) errors.employment_type = 'Choose a valid employment type.';
  if (Number.isNaN(data.experience_min) || data.experience_min < 0 || data.experience_min > 40) {
    errors.experience_min = 'Experience must be between 0 and 40 years.';
  }
  if (data.salary_min === undefined || Number.isNaN(data.salary_min) || data.salary_min < 0) {
    errors.salary_min = 'Enter a valid minimum salary.';
  }
  if (data.salary_max === undefined || Number.isNaN(data.salary_max) || data.salary_max < 0) {
    errors.salary_max = 'Enter a valid maximum salary.';
  } else if (!errors.salary_min && data.salary_max < data.salary_min) {
    errors.salary_max = 'Maximum salary must be greater than or equal to minimum salary.';
  }
  if (data.application_deadline) {
    if (Number.isNaN(data.application_deadline.getTime())) errors.application_deadline = 'Invalid date.';
    else if (isCreate || body.application_deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (data.application_deadline < today) errors.application_deadline = 'Deadline cannot be in the past.';
    }
  }
  if (data.max_applicants !== undefined && (Number.isNaN(data.max_applicants) || data.max_applicants < 1 || data.max_applicants > 10000 || !Number.isInteger(data.max_applicants))) {
    errors.max_applicants = 'Applicant limit must be a whole number between 1 and 10000, or left empty for no limit.';
  }
  throwIfErrors(errors);
  // On update, a missing applicant limit means "keep it"; null or "" removes it
  if (!isCreate && !Object.prototype.hasOwnProperty.call(body, 'max_applicants')) delete data.max_applicants;
  else if (data.max_applicants === undefined && !isCreate) data.max_applicants = null;
  // On update, a missing deadline means "keep the current one"; null or "" clears it
  if (!isCreate && !Object.prototype.hasOwnProperty.call(body, 'application_deadline')) delete data.application_deadline;
  return data;
}

async function loadOwnJob(req) {
  assertValidId(req.params.id || req.params.jobId, 'job id');
  const job = await Job.findById(req.params.id || req.params.jobId);
  if (!job) throw new AppError(404, 'Job not found.');
  if (String(job.employer) !== String(req.user._id)) throw new AppError(403, 'You can only manage your own job postings.');
  return job;
}

// GET /api/v1/jobs   (job seekers: only matching jobs, sorted by relevance)
const getMatchedJobs = asyncHandler(async (req, res) => {
  const { profile, scores } = await loadSeekerContext(req.user._id);

  const filter = visibleJobFilter();
  const and = [];
  const q = cleanString(req.query.q, 100);
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: re }, { description: re }, { company_name: re }, { skills_required: re }] });
  }
  const location = cleanString(req.query.location, 100);
  if (location) {
    const options = [{ location: new RegExp(escapeRegex(location), 'i') }];
    if (/remote/i.test(location)) options.push({ is_remote: true });
    and.push({ $or: options });
  }
  if (req.query.employment_type) {
    if (!EMPLOYMENT_TYPES.includes(req.query.employment_type)) throw new AppError(400, 'Invalid employment type filter.');
    and.push({ employment_type: req.query.employment_type });
  }
  const minSalary = toNumber(req.query.min_salary);
  if (minSalary !== undefined) {
    if (Number.isNaN(minSalary)) throw new AppError(400, 'Minimum salary filter must be a number.');
    and.push({ salary_max: { $gte: minSalary } });
  }
  if (and.length) filter.$and = and;

  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(500);
  const applied = new Set(
    (await Application.find({ applicant: req.user._id }).select('job')).map((a) => String(a.job))
  );

  let results = jobs
    .map((job) => ({ job, match: computeMatch(profile, scores, job) }))
    .filter((r) => r.match.is_match); // US3: non-matching jobs are never shown

  const sort = req.query.sort || 'relevance';
  if (sort === 'newest') results.sort((a, b) => b.job.createdAt - a.job.createdAt);
  else if (sort === 'salary') results.sort((a, b) => b.job.salary_max - a.job.salary_max);
  else results.sort((a, b) => b.match.score - a.match.score || b.job.createdAt - a.job.createdAt);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const total = results.length;
  results = results.slice((page - 1) * limit, page * limit);

  res.json({
    jobs: results.map(({ job, match }) => ({
      ...job.toJSON(),
      match,
      has_applied: applied.has(String(job._id)),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

// GET /api/v1/jobs/mine   (employer's own jobs with application counts)
const getMyJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ employer: req.user._id }).sort({ createdAt: -1 });
  const counts = await Application.aggregate([
    { $match: { employer: req.user._id } },
    { $group: { _id: { job: '$job', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const byJob = new Map();
  counts.forEach((c) => {
    const key = String(c._id.job);
    const entry = byJob.get(key) || { total: 0, by_status: {} };
    if (c._id.status !== 'withdrawn') entry.total += c.count;
    entry.by_status[c._id.status] = c.count;
    byJob.set(key, entry);
  });
  res.json({
    jobs: jobs.map((j) => {
      const c = byJob.get(String(j._id)) || { total: 0, by_status: {} };
      return { ...j.toJSON(), application_count: c.total, status_counts: c.by_status };
    }),
  });
});

// GET /api/v1/jobs/:id
const getJobById = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'job id');
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError(404, 'Job not found.');

  const isOwner = String(job.employer) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (job.moderation_status === 'removed' && !isOwner && !isAdmin) throw new AppError(404, 'Job not found.');

  const result = { ...job.toJSON() };
  result.application_count = await countActive(job._id);
  if (req.user.role === ROLES.JOB_SEEKER) {
    const application = await Application.findOne({ job: job._id, applicant: req.user._id }).select('status createdAt');
    const { profile, scores } = await loadSeekerContext(req.user._id, { required: false });
    result.match = profile && scores ? computeMatch(profile, scores, job) : null;
    result.my_application = application;
    result.is_saved = Boolean(await SavedJob.exists({ seeker: req.user._id, job: job._id }));
    // A company can have several HR accounts: following any of them means following the company
    result.is_following = Boolean(
      await Follow.exists({ seeker: req.user._id, employer: { $in: await companyUserIds(job.employer) } })
    );
    const deadlinePassed = job.application_deadline && job.application_deadline < new Date();
    const limitReached = job.max_applicants && result.application_count >= job.max_applicants;
    result.can_apply = !application && job.status === 'open' && !deadlinePassed && !limitReached;
    // Tells the page why applying is not possible
    if (!application && !result.can_apply) {
      if (job.closed_reason === 'filled') result.closed_message = 'This position has been filled. Thank you for your interest.';
      else if (limitReached || job.closed_reason === 'limit_reached')
        result.closed_message = 'This job has reached its applicant limit and is no longer accepting applications.';
      else if (deadlinePassed) result.closed_message = 'The application deadline for this job has passed.';
      else result.closed_message = 'This job is no longer accepting applications.';
    }
  }
  res.json({ job: result });
});

// POST /api/v1/jobs
const createJob = asyncHandler(async (req, res) => {
  const profile = await EmployerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError(400, 'Please create your company profile before posting jobs.', { code: 'PROFILE_REQUIRED' });
  if (requireEmployerVerification() && profile.verification.status !== 'approved') {
    throw new AppError(403, 'Your company must be verified by an administrator before you can post jobs.', {
      code: 'VERIFICATION_REQUIRED',
    });
  }
  const data = buildJobData(req.body, { isCreate: true });
  if (!data.culture_tags.length) data.culture_tags = profile.culture_tags || [];
  const job = await Job.create({
    ...data,
    employer: req.user._id,
    employer_profile: profile._id,
    company_name: profile.company_name,
  });
  const notified = await announceNewJob(job);
  res.status(201).json({ message: 'Your job is live. Matching candidates can now see it and apply.', job, notified });
});

// PUT /api/v1/jobs/:id
const updateJob = asyncHandler(async (req, res) => {
  const job = await loadOwnJob(req);
  if (job.moderation_status === 'removed') throw new AppError(403, 'This job was removed by an administrator and cannot be edited.');
  job.set(buildJobData(req.body, { isCreate: false }));
  await job.save();
  res.json({ message: 'Your changes have been saved.', job });
});

// PATCH /api/v1/jobs/:id/status   body: { status: "open" | "closed" }
const updateJobStatus = asyncHandler(async (req, res) => {
  const job = await loadOwnJob(req);
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) throw new AppError(400, 'Status must be open or closed.');
  if (job.moderation_status === 'removed') throw new AppError(403, 'This job was removed by an administrator.');
  if (status === 'open') {
    if (job.closed_reason === 'filled') throw new AppError(409, 'This position was marked as filled. Post a new job for a new opening.');
    if (job.max_applicants && (await countActive(job._id)) >= job.max_applicants) {
      throw new AppError(409, 'This job has reached its applicant limit. Increase the limit in "Edit job" before reopening it.');
    }
    job.closed_reason = undefined;
  } else {
    job.closed_reason = 'manual';
  }
  job.status = status;
  await job.save();
  res.json({ message: status === 'open' ? 'The job is open again and accepting applications.' : 'The job is closed. Candidates can no longer apply.', job });
});

// DELETE /api/v1/jobs/:id   (only when nobody has applied yet)
const deleteJob = asyncHandler(async (req, res) => {
  const job = await loadOwnJob(req);
  if (await Application.exists({ job: job._id })) {
    throw new AppError(409, 'This job already has applications. Close it instead of deleting it.');
  }
  await job.deleteOne();
  res.json({ message: 'The job has been deleted.' });
});

// Copies the profile resume so the application keeps its own copy even if the profile changes
function copyResume(meta) {
  if (!meta?.stored_name) return undefined;
  const source = storedPath('documents', meta.stored_name);
  if (!fs.existsSync(source)) return undefined;
  const newName = `${crypto.randomBytes(16).toString('hex')}${path.extname(meta.stored_name)}`;
  fs.copyFileSync(source, storedPath('documents', newName));
  return { ...meta.toObject?.() ?? meta, stored_name: newName };
}

// POST /api/v1/jobs/:jobId/apply   body: { cover_letter_text? }
const applyForJob = asyncHandler(async (req, res) => {
  assertValidId(req.params.jobId, 'job id');
  const { profile, scores } = await loadSeekerContext(req.user._id);

  const job = await Job.findOne({ _id: req.params.jobId, ...visibleJobFilter() });
  if (!job) throw new AppError(404, 'This job is not available for applications.');

  const match = computeMatch(profile, scores, job);
  if (!match.is_match) {
    // US4 negative criterion
    throw new AppError(403, 'You can only apply for jobs that match your skills and preferences.');
  }
  if (await Application.exists({ job: job._id, applicant: req.user._id })) {
    throw new AppError(409, 'You have already applied for this job.');
  }
  if (job.max_applicants && (await countActive(job._id)) >= job.max_applicants) {
    throw new AppError(409, 'This job has reached its applicant limit and is no longer accepting applications.');
  }

  const coverLetter = cleanString(req.body.cover_letter_text, 2000);
  const application = await Application.create({
    job: job._id,
    applicant: req.user._id,
    employer: job.employer,
    cover_letter_text: coverLetter,
    resume: copyResume(profile.resume),
    match_score: match.score,
    status: 'submitted',
    status_history: [{ status: 'submitted', changed_by: req.user._id }],
  });

  // US4: confirmation email
  const emailStatus = await sendApplicationConfirmation({
    to: req.user.email,
    name: profile.full_name || req.user.name,
    jobTitle: job.title,
    companyName: job.company_name,
  });
  application.confirmation_email = { status: emailStatus, sent_at: new Date() };
  await application.save();

  // Employer notifications: new application, and a one-time alert when the limit is reached
  const total = await countActive(job._id);
  await notify(job.employer, {
    type: 'new_application',
    title: `New application for ${job.title}`,
    message: `${profile.full_name || req.user.name} applied (${match.score}% match).${job.max_applicants ? ` ${total} of ${job.max_applicants} applications received.` : ` ${total} application${total === 1 ? '' : 's'} so far.`}`,
    link: `/employer/jobs/${job._id}/applicants`,
  });
  if (job.max_applicants && total >= job.max_applicants && job.status === 'open') {
    job.status = 'closed';
    job.closed_reason = 'limit_reached';
    await job.save();
    await notify(job.employer, {
      type: 'applicant_limit',
      title: `Applicant limit reached for ${job.title}`,
      message: `You have received ${total} applications, the limit you set. The job is now closed to new applicants. To accept more, increase the limit and reopen the job.`,
      link: `/employer/jobs/${job._id}/applicants`,
    });
  }
  // Applying counts as acting on a saved job
  await SavedJob.deleteOne({ seeker: req.user._id, job: job._id });

  res.status(200).json({
    message: 'Your application has been submitted',
    email_status: emailStatus,
    application: { id: application._id, status: application.status, match_score: application.match_score, createdAt: application.createdAt },
  });
});

// GET /api/v1/jobs/:jobId/applications   (employer who owns the job)
const getJobApplications = asyncHandler(async (req, res) => {
  const job = await loadOwnJob(req);
  const applications = await Application.find({ job: job._id })
    .populate('applicant', 'name email')
    .sort({ match_score: -1, createdAt: 1 });

  const profiles = await SeekerProfile.find({ user: { $in: applications.map((a) => a.applicant?._id) } }).select(
    'user full_name headline location skills education experience social_links'
  );
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  res.json({
    job: { id: job._id, title: job.title, status: job.status, closed_reason: job.closed_reason, max_applicants: job.max_applicants, application_deadline: job.application_deadline },
    applications: applications.map((a) => ({
      id: a._id,
      status: a.status,
      match_score: a.match_score,
      cover_letter_text: a.cover_letter_text,
      has_resume: Boolean(a.resume?.stored_name),
      createdAt: a.createdAt,
      status_history: a.status_history,
      applicant: a.applicant ? { id: a.applicant._id, name: a.applicant.name, email: a.applicant.email } : null,
      profile: profileMap.get(String(a.applicant?._id)) || null,
    })),
  });
});

// PATCH /api/v1/jobs/:id/fill   (employer) body: { message? }
// Closes the job as filled and tells every candidate still in the process.
const markFilled = asyncHandler(async (req, res) => {
  const job = await loadOwnJob(req);
  if (job.closed_reason === 'filled') throw new AppError(409, 'This position is already marked as filled.');
  const active = await Application.find({ job: job._id, status: { $in: ACTIVE_APPLICATION_STATUSES } });
  const note = cleanString(req.body.message, 500);
  for (const application of active) {
    application.status = 'position_filled';
    application.status_history.push({ status: 'position_filled', changed_by: req.user._id, note });
    await application.save();
  }
  job.status = 'closed';
  job.closed_reason = 'filled';
  job.filled_at = new Date();
  await job.save();
  const wording = statusMessage({ status: 'position_filled', jobTitle: job.title, company: job.company_name, entry: {} });
  await notify(
    active.map((a) => a.applicant),
    { ...wording, message: note ? `${wording.message} Message from ${job.company_name}: "${note}"` : wording.message, link: '/applications' }
  );
  res.json({
    message: active.length
      ? `Position marked as filled. ${active.length} other candidate${active.length === 1 ? ' has' : 's have'} been notified.`
      : 'Position marked as filled.',
    job,
    notified: active.length,
  });
});

// POST /api/v1/jobs/:id/save  and  DELETE /api/v1/jobs/:id/save   (job seeker)
const saveJob = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'job id');
  if (!(await Job.exists({ _id: req.params.id, moderation_status: 'active' }))) throw new AppError(404, 'Job not found.');
  await SavedJob.updateOne({ seeker: req.user._id, job: req.params.id }, { $setOnInsert: { seeker: req.user._id, job: req.params.id } }, { upsert: true });
  res.json({ message: "Job saved. We'll remind you before the deadline.", saved: true });
});
const unsaveJob = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'job id');
  await SavedJob.deleteOne({ seeker: req.user._id, job: req.params.id });
  res.json({ message: 'Job removed from your saved list.', saved: false });
});

// GET /api/v1/jobs/saved   (job seeker)
const getSavedJobs = asyncHandler(async (req, res) => {
  const saved = await SavedJob.find({ seeker: req.user._id }).populate('job').sort({ createdAt: -1 });
  res.json({
    jobs: saved
      .filter((s) => s.job && s.job.moderation_status === 'active')
      .map((s) => ({ ...s.job.toJSON(), saved_at: s.createdAt })),
  });
});

const words = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 2);

/**
 * After a job is posted: tells seekers who follow the company, and seekers whose
 * desired roles match the job title. Each person gets at most one notification.
 */
async function announceNewJob(job) {
  try {
    // Followers of the company (anyone in it), not just of this recruiter's account
    const followers = await Follow.find({ employer: { $in: await companyUserIds(job.employer) } }).select('seeker');
    const followerIds = new Set(followers.map((f) => String(f.seeker)));
    await notify([...followerIds], {
      type: 'followed_company_job',
      title: `${job.company_name} posted a new job`,
      message: `${job.title} \u00b7 ${job.location}${job.application_deadline ? ` \u00b7 Apply by ${new Date(job.application_deadline).toLocaleDateString('en-GB')}` : ''}`,
      link: `/jobs/${job._id}`,
    });

    const titleWords = new Set(words(job.title));
    const seekers = await SeekerProfile.find({ 'job_preferences.desired_roles.0': { $exists: true } })
      .select('user job_preferences.desired_roles')
      .limit(2000);
    const interested = seekers
      .filter((p) => !followerIds.has(String(p.user)))
      .filter((p) => (p.job_preferences?.desired_roles || []).some((role) => words(role).some((w) => titleWords.has(w))))
      .map((p) => p.user);
    await notify(interested, {
      type: 'new_job',
      title: `New job that matches what you're looking for: ${job.title}`,
      message: `${job.company_name} \u00b7 ${job.location}. Open it to see your match score.`,
      link: `/jobs/${job._id}`,
    });
    return followerIds.size + interested.length;
  } catch (err) {
    console.error('Could not announce new job:', err.message);
    return 0;
  }
}

module.exports = {
  getMatchedJobs,
  getMyJobs,
  getJobById,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
  applyForJob,
  getJobApplications,
  markFilled,
  saveJob,
  unsaveJob,
  getSavedJobs,
  announceNewJob,
  visibleJobFilter,
};
