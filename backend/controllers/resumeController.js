const path = require('path');
const Job = require('../models/Job');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, assertValidId } = require('../utils/validators');
const { extractText } = require('../services/textExtractor');
const { analyzeResume, WEIGHTS } = require('../services/atsService');
const { computeMatch } = require('../services/matchingService');
const { loadSeekerContext } = require('../services/seekerContext');

// Same rule as the job feed: open, approved and not past its deadline
const openJobFilter = () => ({
  status: 'open',
  moderation_status: 'active',
  $or: [{ application_deadline: null }, { application_deadline: { $gte: new Date() } }],
});

// GET /api/v1/resumes/jobs   every open job the ATS checker can compare a resume with.
// Jobs that match the seeker (40%+) come first and are marked, but all open jobs are listed.
const listJobsForAts = asyncHandler(async (req, res) => {
  const jobs = await Job.find(openJobFilter())
    .select('title company_name location skills_required preferred_skills employment_type is_remote culture_tags salary_min salary_max experience_min')
    .sort({ createdAt: -1 })
    .limit(200);
  const { profile, scores } = await loadSeekerContext(req.user._id, { required: false });
  const list = jobs.map((job) => {
    const match = profile && scores ? computeMatch(profile, scores, job) : null;
    return {
      _id: job._id,
      title: job.title,
      company_name: job.company_name,
      location: job.location,
      match_score: match ? match.score : null,
      is_match: Boolean(match && match.is_match),
    };
  });
  list.sort((a, b) => Number(b.is_match) - Number(a.is_match) || (b.match_score || 0) - (a.match_score || 0));
  res.json({ jobs: list });
});

const SCORING_METHOD = {
  description:
    'Transparent rule-based estimate of how closely your resume text matches the job description. ' +
    'It is not the output of any commercial Applicant Tracking System.',
  weights: WEIGHTS,
  formula:
    'Overall = sum(component score × weight) ÷ sum(weights of applicable components). ' +
    'Experience and education are only scored when the job description asks for them.',
};

// POST /api/v1/resumes/analyze   multipart: resume (PDF/DOCX) + job_id OR job_description (+ job_title)
const analyze = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Please upload your resume as a PDF or DOCX file (max 2 MB).');

  const jobId = cleanString(req.body.job_id, 30);
  let job;
  let source;
  if (jobId) {
    assertValidId(jobId, 'job id');
    const found = await Job.findOne({ _id: jobId, moderation_status: 'active' });
    if (!found) throw new AppError(404, 'Selected job not found.');
    job = {
      title: found.title,
      description: found.description,
      qualifications: found.qualifications,
      skills: found.skills_required,
      experience_min: found.experience_min,
      id: found._id,
    };
    source = 'job';
  } else {
    const description = cleanString(req.body.job_description, 8000);
    const words = description ? description.split(/\s+/).length : 0;
    if (!description || words < 25) {
      throw new AppError(400, 'Please paste the full job description (at least 25 words) or choose a job from the list.', {
        job_description: 'Job description is too short.',
      });
    }
    job = { title: cleanString(req.body.job_title, 150) || 'Custom job description', description, skills: [] };
    source = 'custom';
  }

  const { text, wordCount, fileType } = await extractText(req.file);
  const result = analyzeResume(text, wordCount, job);

  const saved = await ResumeAnalysis.create({
    user: req.user._id,
    job: job.id,
    source,
    job_title: job.title,
    file_name: path.basename(req.file.originalname).slice(0, 150),
    file_type: fileType,
    word_count: wordCount,
    ...result,
  });

  res.status(201).json({ message: 'Resume analysed successfully', analysis: saved, scoring_method: SCORING_METHOD });
});

// GET /api/v1/resumes/history
const getHistory = asyncHandler(async (req, res) => {
  const items = await ResumeAnalysis.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('job_title file_name overall_score source createdAt');
  res.json({ history: items });
});

// GET /api/v1/resumes/history/:id
const getAnalysis = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'analysis id');
  const analysis = await ResumeAnalysis.findOne({ _id: req.params.id, user: req.user._id });
  if (!analysis) throw new AppError(404, 'Analysis not found.');
  res.json({ analysis, scoring_method: SCORING_METHOD });
});

// DELETE /api/v1/resumes/history/:id
const deleteAnalysis = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'analysis id');
  const deleted = await ResumeAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!deleted) throw new AppError(404, 'Analysis not found.');
  res.json({ message: 'Analysis deleted' });
});

module.exports = { analyze, getHistory, getAnalysis, deleteAnalysis, listJobsForAts };
