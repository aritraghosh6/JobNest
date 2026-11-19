const express = require('express');
const c = require('../controllers/assessmentController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER));

router.get('/questions', c.getQuestions);
router.post('/submit', c.submitAssessment);
router.get('/latest', c.getLatest);
router.get('/history', c.getHistory);
router.get('/:id', c.getById);

module.exports = router;
