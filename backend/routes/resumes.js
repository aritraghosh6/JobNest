const express = require('express');
const c = require('../controllers/resumeController');
const { protect, authorize } = require('../middleware/auth');
const { uploadResumeForAnalysis } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER));

router.get('/jobs', c.listJobsForAts);
router.post('/analyze', uploadResumeForAnalysis, c.analyze);
router.get('/history', c.getHistory);
router.get('/history/:id', c.getAnalysis);
router.delete('/history/:id', c.deleteAnalysis);

module.exports = router;
