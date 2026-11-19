const Follow = require('../models/Follow');
const User = require('../models/User');
const EmployerProfile = require('../models/EmployerProfile');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const { assertValidId } = require('../utils/validators');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { computeMatch } = require('../services/matchingService');
const { loadSeekerContext } = require('../services/seekerContext');
const { companyUserIds } = require('../services/companyGroup');

const SUGGEST_MIN_SCORE = 50; // only suggest jobs that match the seeker by at least 50%

// POST /api/v1/follows/:employerId   (job seeker follows a company)
const follow = asyncHandler(async (req, res) => {
  assertValidId(req.params.employerId, 'company id');
  const employer = await User.findOne({ _id: req.params.employerId, role: ROLES.EMPLOYER, is_active: true }).select('_id');
  if (!employer) throw new AppError(404, 'Company not found.');
  // Following one HR account of a company = following the whole company; don't add a second follow
  const members = await companyUserIds(employer._id);
  if (await Follow.exists({ seeker: req.user._id, employer: { $in: members } })) {
    return res.json({ message: "You're already following this company.", following: true });
  }
  await Follow.updateOne(
    { seeker: req.user._id, employer: employer._id },
    { $setOnInsert: { seeker: req.user._id, employer: employer._id } },
    { upsert: true }
  );
  res.json({ message: "You're following this company. We'll tell you when it posts a new job.", following: true });
});

// DELETE /api/v1/follows/:employerId
const unfollow = asyncHandler(async (req, res) => {
  assertValidId(req.params.employerId, 'company id');
  // Remove the follow whichever HR account of this company it was made through
  const members = await companyUserIds(req.params.employerId);
  await Follow.deleteMany({ seeker: req.user._id, employer: { $in: members } });
  res.json({ message: 'You have unfollowed this company.', following: false });
});

// GET /api/v1/follows   (companies the seeker follows, each with its open jobs that match you by 50%+)
const listFollowing = asyncHandler(async (req, res) => {
  const follows = await Follow.find({ seeker: req.user._id }).sort({ createdAt: -1 });
  const profiles = await EmployerProfile.find({ user: { $in: follows.map((f) => f.employer) } }).select(
    'user company_name industry location logo'
  );
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));

  // Your profile and assessment are needed to work out match scores
  const { profile, scores } = await loadSeekerContext(req.user._id, { required: false });
  const canMatch = Boolean(profile && scores);
  const applied = new Set((await Application.find({ applicant: req.user._id }).select('job')).map((a) => String(a.job)));

  // One card per company, even if older follows point at two HR accounts of the same company
  const seenCompanies = new Set();
  const companies = await Promise.all(
    follows.map(async (f) => {
      const p = byUser.get(String(f.employer));
      if (!p) return null;
      const key = String((await companyUserIds(f.employer)).map(String).sort()[0]);
      if (seenCompanies.has(key)) return null;
      seenCompanies.add(key);
      let suggested = [];
      if (canMatch) {
        const jobs = await Job.find({
          employer: { $in: await companyUserIds(f.employer) },
          status: 'open',
          moderation_status: 'active',
          $or: [{ application_deadline: null }, { application_deadline: { $gte: new Date() } }],
        })
          .sort({ createdAt: -1 })
          .limit(50);
        suggested = jobs
          .map((job) => ({ job, match: computeMatch(profile, scores, job) }))
          .filter((r) => r.match.score >= SUGGEST_MIN_SCORE)
          .sort((a, b) => b.match.score - a.match.score)
          .slice(0, 5)
          .map(({ job, match }) => ({
            id: job._id,
            title: job.title,
            location: job.location,
            employment_type: job.employment_type,
            application_deadline: job.application_deadline,
            match_score: match.score,
            applied: applied.has(String(job._id)),
          }));
      }
      return {
        employer_id: f.employer,
        company_name: p.company_name,
        industry: p.industry,
        location: p.location,
        logo_url: p.logo?.stored_name ? `/uploads/logos/${p.logo.stored_name}` : null,
        followed_at: f.createdAt,
        suggested_jobs: suggested,
      };
    })
  );
  res.json({ companies: companies.filter(Boolean), can_match: canMatch, min_score: SUGGEST_MIN_SCORE });
});

module.exports = { follow, unfollow, listFollowing };
