const express = require('express');
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.ADMIN));

router.get('/stats', c.getStats);
router.get('/users', c.listUsers);
router.patch('/users/:id/status', c.setUserStatus);
router.get('/employers', c.listEmployers);
router.patch('/employers/:id/verification', c.reviewEmployer);
router.get('/employers/:id/document', c.downloadVerificationDocument);
router.get('/jobs', c.listJobs);
router.patch('/jobs/:id/moderation', c.moderateJob);

module.exports = router;
