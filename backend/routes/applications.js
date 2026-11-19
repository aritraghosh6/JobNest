const express = require('express');
const c = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

router.get('/mine', authorize(ROLES.JOB_SEEKER), c.getMyApplications);
router.get('/:id', authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER), c.getApplication);
router.get('/:id/resume', authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER), c.downloadResume);
router.patch('/:id/status', authorize(ROLES.EMPLOYER), c.updateStatus);
router.patch('/:id/withdraw', authorize(ROLES.JOB_SEEKER), c.withdraw);

module.exports = router;
