const Assessment = require('../models/Assessment');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertValidId } = require('../utils/validators');
const { QUESTIONS, SCALE, DIMENSIONS, VERSION } = require('../data/assessmentQuestions');
const { validateAnswers, scoreAnswers, buildReport } = require('../services/assessmentService');

// GET /api/v1/assessments/questions
const getQuestions = asyncHandler(async (req, res) => {
  res.json({
    version: VERSION,
    instructions: [
      `There are ${QUESTIONS.length} statements. Rate how much you agree with each one.`,
      'There are no right or wrong answers. Answer honestly about how you usually work.',
      'Every question must be answered before you can submit. The assessment cannot be skipped.',
      'It takes about 5 minutes. Your results are private and are used to estimate cultural fit with employers.',
    ],
    scale: SCALE,
    dimensions: Object.fromEntries(Object.entries(DIMENSIONS).map(([k, v]) => [k, v.label])),
    // The dimension of each question is not revealed, to reduce biased answering
    questions: QUESTIONS.map(({ id, text }) => ({ id, text })),
  });
});

// POST /api/v1/assessments/submit   body: { answers: [{ question_id, value }] }
const submitAssessment = asyncHandler(async (req, res) => {
  const answers = validateAnswers(req.body.answers);
  const result = scoreAnswers(answers);
  const assessment = await Assessment.create({ user: req.user._id, answers, version: VERSION, ...result });
  await User.updateOne({ _id: req.user._id }, { assessment_completed: true });
  res.status(201).json({ message: 'Assessment submitted successfully', report: buildReport(assessment) });
});

// GET /api/v1/assessments/latest
const getLatest = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ report: assessment ? buildReport(assessment) : null });
});

// GET /api/v1/assessments/history
const getHistory = asyncHandler(async (req, res) => {
  const items = await Assessment.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select('scores top_traits createdAt')
    .limit(20);
  res.json({
    history: items.map((a) => ({ id: a._id, completed_at: a.createdAt, scores: a.toObject().scores, top_traits: a.top_traits })),
  });
});

// GET /api/v1/assessments/:id   (only the owner can read it)
const getById = asyncHandler(async (req, res) => {
  assertValidId(req.params.id, 'assessment id');
  const assessment = await Assessment.findOne({ _id: req.params.id, user: req.user._id });
  if (!assessment) throw new AppError(404, 'Assessment not found.');
  res.json({ report: buildReport(assessment) });
});

module.exports = { getQuestions, submitAssessment, getLatest, getHistory, getById };
