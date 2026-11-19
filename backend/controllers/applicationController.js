const Application = require('../models/Application');
const Job = require('../models/Job');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { APPLICATION_TRANSITIONS, INTERVIEW_MODES } = require('../config/constants');
const { notify, statusMessage } = require('../services/notificationService');
const { assertValidId, cleanString } = require('../utils/validators');
const { sendStoredFile } = require('../utils/files');

async function loadApplicationFor(req) {
  assertValidId(req.params.id, 'application id');
  const application = await Application.findById(req.params.id).populate(
    'job',
    'title company_name location employment_type status closed_reason salary_min salary_max employer'
  );
  if (!application) throw new AppError(404, 'Application not found.');
  const userId = String(req.user._id);
  const isApplicant = String(application.applicant) === userId;
  const isEmployer = String(application.employer) === userId;
  if (!isApplicant && !isEmployer) throw new AppError(403, 'You do not have access to this application.');
  return { application, isApplicant, isEmployer };
}

function assertTransition(from, to) {
  if (!(APPLICATION_TRANSITIONS[from] || []).includes(to)) {
    throw new AppError(400, `An application cannot move from "${from}" to "${to}".`);
  }
}

const summary = (a) => ({
  id: a._id,
  status: a.status,
  match_score: a.match_score,
  cover_letter_text: a.cover_letter_text,
  has_resume: Boolean(a.resume?.stored_name),
  status_history: a.status_history,
  confirmation_email: a.confirmation_email,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
  job: a.job,
});

// GET /api/v1/applications/mine
const getMyApplications = asyncHandler(async (req, res) => {
  const filter = { applicant: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const applications = await Application.find(filter)
    .populate('job', 'title company_name location employment_type status closed_reason salary_min salary_max employer')
    .sort({ createdAt: -1 });
  res.json({ applications: applications.map(summary) });
});

// GET /api/v1/applications/:id
const getApplication = asyncHandler(async (req, res) => {
  const { application } = await loadApplicationFor(req);
  res.json({ application: summary(application) });
});

// PATCH /api/v1/applications/:id/status   (employer)
// body: { status, note?, stage_label?, scheduled_at?, mode?, location? }
// stage_label / scheduled_at / mode / location describe an assessment or interview step.
const updateStatus = asyncHandler(async (req, res) => {
  const { application, isEmployer } = await loadApplicationFor(req);
  if (!isEmployer) throw new AppError(403, 'Only the employer who posted this job can change its status.');
  const { status } = req.body;
  if (status === 'withdrawn') throw new AppError(400, 'Only the applicant can withdraw an application.');
  if (status === 'position_filled') throw new AppError(400, 'Use "Mark position as filled" on the job instead.');
  assertTransition(application.status, status);

  const entry = { status, changed_by: req.user._id, note: cleanString(req.body.note, 500) };
  if (['assessment', 'interview'].includes(status)) {
    const errors = {};
    entry.stage_label = cleanString(req.body.stage_label, 80);
    entry.location = cleanString(req.body.location, 300);
    if (req.body.mode) {
      if (!INTERVIEW_MODES.includes(req.body.mode)) errors.mode = 'Choose online, in person or phone.';
      else entry.mode = req.body.mode;
    }
    if (req.body.scheduled_at) {
      const when = new Date(req.body.scheduled_at);
      if (Number.isNaN(when.getTime())) errors.scheduled_at = 'Enter a valid date and time.';
      else if (when < new Date(Date.now() - 60 * 1000)) errors.scheduled_at = 'The date and time cannot be in the past.';
      else entry.scheduled_at = when;
    } else if (status === 'interview') {
      errors.scheduled_at = 'Choose the interview date and time.';
    }
    if (status === 'interview' && !entry.mode) errors.mode = 'Choose how the interview will take place.';
    if (Object.keys(errors).length) throw new AppError(400, 'Please complete the interview details.', errors);
  }

  application.status = status;
  application.status_history.push(entry);
  await application.save();

  const job = application.job || {};
  await notify(application.applicant, {
    ...statusMessage({ status, jobTitle: job.title || 'your application', company: job.company_name || 'The employer', entry }),
    link: '/applications',
  });

  res.json({
    message: status === 'hired' ? 'Candidate selected. The candidate has been notified.' : 'Status updated. The candidate has been notified.',
    application: summary(application),
  });
});

// PATCH /api/v1/applications/:id/withdraw   (applicant)
const withdraw = asyncHandler(async (req, res) => {
  const { application, isApplicant } = await loadApplicationFor(req);
  if (!isApplicant) throw new AppError(403, 'Only the applicant can withdraw this application.');
  assertTransition(application.status, 'withdrawn');
  application.status = 'withdrawn';
  application.status_history.push({ status: 'withdrawn', changed_by: req.user._id });
  await application.save();

  // A withdrawn application frees its place: reopen a job that was closed only because it was full
  const job = await Job.findById(application.job?._id || application.job);
  if (job && job.status === 'closed' && job.closed_reason === 'limit_reached' && job.max_applicants) {
    const active = await Application.countDocuments({ job: job._id, status: { $ne: 'withdrawn' } });
    if (active < job.max_applicants && (!job.application_deadline || job.application_deadline > new Date())) {
      job.status = 'open';
      job.closed_reason = undefined;
      await job.save();
    }
  }
  await notify(application.employer, {
    type: 'application_update',
    title: `${req.user.name} withdrew from ${application.job?.title || 'your job'}`,
    message: `${req.user.name} has withdrawn their application. It no longer counts towards your applicant limit.`,
    link: application.job ? `/employer/jobs/${application.job._id}/applicants` : '/employer/jobs',
  });
  res.json({ message: 'Your application has been withdrawn.', application: summary(application) });
});

// GET /api/v1/applications/:id/resume   (applicant or the job's employer)
const downloadResume = asyncHandler(async (req, res) => {
  const { application } = await loadApplicationFor(req);
  sendStoredFile(res, 'documents', application.resume);
});

module.exports = { getMyApplications, getApplication, updateStatus, withdraw, downloadResume };
