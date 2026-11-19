const { QUESTIONS, DIMENSIONS } = require('../data/assessmentQuestions');
const AppError = require('../utils/AppError');

/**
 * Validates that EVERY question has exactly one answer between 1 and 5.
 * The assessment cannot be partially submitted or skipped (US2 negative criterion).
 * Returns the answers in the stored format.
 */
function validateAnswers(answers) {
  if (!Array.isArray(answers)) throw new AppError(400, 'Answers must be a list.');
  const byId = new Map();
  for (const item of answers) {
    if (!item || typeof item.question_id !== 'string') throw new AppError(400, 'Each answer needs a question_id.');
    const value = Number(item.value);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new AppError(400, `Answer for question ${item.question_id} must be a whole number from 1 to 5.`);
    }
    byId.set(item.question_id, value);
  }
  const unknown = [...byId.keys()].filter((id) => !QUESTIONS.some((q) => q.id === id));
  if (unknown.length) throw new AppError(400, `Unknown question id(s): ${unknown.join(', ')}`);

  const unanswered = QUESTIONS.filter((q) => !byId.has(q.id));
  if (unanswered.length) {
    throw new AppError(400, `Please answer all ${QUESTIONS.length} questions. ${unanswered.length} question(s) are unanswered.`, {
      unanswered: unanswered.map((q) => q.id),
    });
  }
  return QUESTIONS.map((q) => ({ question_id: q.id, value: byId.get(q.id) }));
}

/**
 * Scoring method:
 *  1. Reverse-worded statements are scored as (6 - answer).
 *  2. Each dimension's 4 answers are averaged (range 1-5).
 *  3. The average is converted to 0-100: (average - 1) / 4 * 100.
 */
function scoreAnswers(answers) {
  const values = new Map(answers.map((a) => [a.question_id, a.value]));
  const scores = {};
  for (const dimension of Object.keys(DIMENSIONS)) {
    const items = QUESTIONS.filter((q) => q.dimension === dimension);
    const total = items.reduce((sum, q) => {
      const v = values.get(q.id);
      return sum + (q.reverse ? 6 - v : v);
    }, 0);
    const average = total / items.length;
    scores[dimension] = Math.round(((average - 1) / 4) * 100);
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topTraits = ranked.slice(0, 2).map(([key]) => key);
  const summary =
    `Your strongest work-style preferences are ${DIMENSIONS[topTraits[0]].label.toLowerCase()} ` +
    `(${scores[topTraits[0]]}/100) and ${DIMENSIONS[topTraits[1]].label.toLowerCase()} ` +
    `(${scores[topTraits[1]]}/100). These results are indicative and based only on your own answers.`;

  return { scores, top_traits: topTraits, summary };
}

const levelFor = (score) => (score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low');

/** Builds the readable report sent to the frontend. */
function buildReport(assessment) {
  const plain = typeof assessment.toObject === 'function' ? assessment.toObject() : assessment;
  const { scores } = plain;
  const dimensions = Object.entries(DIMENSIONS).map(([key, info]) => {
    const score = scores[key];
    const level = levelFor(score);
    return {
      key,
      label: info.label,
      score,
      level,
      description: level === 'low' ? info.low : level === 'high' ? info.high : `You are balanced here. ${info.high}`,
      suited_environments: level === 'low' ? null : info.environments,
    };
  });
  return {
    id: assessment._id,
    completed_at: assessment.createdAt,
    summary: assessment.summary,
    top_traits: assessment.top_traits,
    scores,
    dimensions,
    disclaimer:
      'This is an indicative work-style questionnaire created for JobNest. It is not a clinical or ' +
      'scientifically validated personality test. Use it as one input when thinking about the kind of ' +
      'workplace you may enjoy.',
  };
}

/**
 * Cultural fit between a seeker's scores and the culture tags of a job/company.
 * Returns the average of the seeker's scores on those tags (0-100), or null if the job has no tags.
 */
function cultureFit(scores, cultureTags) {
  if (!scores || !Array.isArray(cultureTags) || cultureTags.length === 0) return null;
  const values = cultureTags.map((tag) => scores[tag]).filter((v) => typeof v === 'number');
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

module.exports = { validateAnswers, scoreAnswers, buildReport, cultureFit };
