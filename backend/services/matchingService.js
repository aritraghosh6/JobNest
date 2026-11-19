const { normalizeSkill, displaySkill } = require('../data/skills');
const { cultureFit } = require('./assessmentService');
const { MATCH_THRESHOLD } = require('../config/constants');

/**
 * Transparent rule-based job matching (not AI).
 *
 *   Skills       60%  share of the job's required skills found in the seeker's profile
 *   Preferences  20%  average of three checks: location, job type, desired role
 *   Culture fit  20%  seeker's assessment scores on the job's culture tags
 *                     (50 = neutral when the job has no culture tags)
 *
 * A job "matches" when at least one required skill matches AND the score >= MATCH_THRESHOLD.
 */
const WEIGHTS = { skills: 0.6, preferences: 0.2, culture: 0.2 };

const lower = (s) => String(s || '').toLowerCase().trim();

function locationMatches(profile, job) {
  const prefs = (profile.job_preferences?.preferred_locations || []).map(lower).filter(Boolean);
  const jobLocation = lower(job.location);
  if (job.is_remote && profile.job_preferences?.open_to_remote) return true;
  if (prefs.length === 0) return lower(profile.location) && jobLocation.includes(lower(profile.location));
  return prefs.some((p) => p === 'any' || jobLocation.includes(p) || p.includes(jobLocation));
}

function jobTypeMatches(profile, job) {
  const types = profile.job_preferences?.job_types || [];
  return types.includes(job.employment_type);
}

function roleMatches(profile, job) {
  const title = lower(job.title);
  const roles = (profile.job_preferences?.desired_roles || []).map(lower).filter(Boolean);
  return roles.some((role) => {
    if (title.includes(role) || role.includes(title)) return true;
    // Any meaningful word of the desired role appears in the title ("frontend developer" ~ "React Developer")
    return role.split(/\s+/).some((word) => word.length > 3 && title.includes(word));
  });
}

function computeMatch(profile, assessmentScores, job) {
  const seekerSkills = new Set((profile.skills || []).map(normalizeSkill));
  const required = (job.skills_required || []).map((s) => ({ key: normalizeSkill(s), name: displaySkill(s) }));
  const matched = required.filter((s) => seekerSkills.has(s.key)).map((s) => s.name);
  const missing = required.filter((s) => !seekerSkills.has(s.key)).map((s) => s.name);

  const skillScore = required.length ? (matched.length / required.length) * 100 : 0;

  const checks = {
    location: Boolean(locationMatches(profile, job)),
    job_type: jobTypeMatches(profile, job),
    role: roleMatches(profile, job),
  };
  const prefScore = (Object.values(checks).filter(Boolean).length / 3) * 100;

  const fit = cultureFit(assessmentScores, job.culture_tags);
  const cultureScore = fit === null ? 50 : fit;

  const score = Math.round(
    skillScore * WEIGHTS.skills + prefScore * WEIGHTS.preferences + cultureScore * WEIGHTS.culture
  );

  const reasons = [];
  if (required.length) reasons.push(`You have ${matched.length} of ${required.length} required skills.`);
  if (checks.location) reasons.push('Location fits your preferences.');
  if (checks.job_type) reasons.push('Employment type matches your preferences.');
  if (checks.role) reasons.push('Job title matches a role you are looking for.');
  if (fit !== null) reasons.push(`Cultural fit based on your assessment: ${fit}/100.`);
  else reasons.push('The employer has not tagged this job with culture traits, so culture fit is neutral.');

  return {
    score,
    is_match: matched.length > 0 && score >= MATCH_THRESHOLD,
    matched_skills: matched,
    missing_skills: missing,
    breakdown: {
      skills: Math.round(skillScore),
      preferences: Math.round(prefScore),
      culture: fit,
    },
    checks,
    reasons,
  };
}

module.exports = { computeMatch, WEIGHTS };
