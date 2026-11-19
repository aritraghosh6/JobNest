const express = require('express');
const c = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const seeker = authorize(ROLES.JOB_SEEKER);
const employer = authorize(ROLES.EMPLOYER);

router.get('/', seeker, c.getMatchedJobs); // US3
router.get('/mine', employer, c.getMyJobs); // US6
router.get('/saved', seeker, c.getSavedJobs);
router.post('/', employer, c.createJob); // US6
router.get('/:id', c.getJobById);
router.put('/:id', employer, c.updateJob);
router.patch('/:id/status', employer, c.updateJobStatus);
router.delete('/:id', employer, c.deleteJob);
router.patch('/:id/fill', employer, c.markFilled);
router.post('/:id/save', seeker, c.saveJob);
router.delete('/:id/save', seeker, c.unsaveJob);
router.post('/:jobId/apply', seeker, c.applyForJob); // US4
router.get('/:jobId/applications', employer, c.getJobApplications);

module.exports = router;
