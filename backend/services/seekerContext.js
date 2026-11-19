const SeekerProfile = require('../models/SeekerProfile');
const Assessment = require('../models/Assessment');
const AppError = require('../utils/AppError');

/**
 * Loads what job matching needs for a seeker: their profile and latest assessment scores.
 * Matching requires both (US1 profile + US2 "the assessment cannot be skipped").
 * Errors carry a "code" so the frontend can link to the right page.
 */
async function loadSeekerContext(userId, { required = true } = {}) {
  const [profile, assessment] = await Promise.all([
    SeekerProfile.findOne({ user: userId }),
    Assessment.findOne({ user: userId }).sort({ createdAt: -1 }).select('scores'),
  ]);
  if (required && !profile) {
    throw new AppError(400, 'Please create your profile first so we can match jobs to your skills.', {
      code: 'PROFILE_REQUIRED',
    });
  }
  if (required && !assessment) {
    throw new AppError(403, 'Please complete the personality assessment before viewing or applying for jobs.', {
      code: 'ASSESSMENT_REQUIRED',
    });
  }
  const scores = assessment ? assessment.toObject().scores : undefined;
  return { profile, scores };
}

module.exports = { loadSeekerContext };
