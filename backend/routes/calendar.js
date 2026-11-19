const express = require('express');
const c = require('../controllers/calendarController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER));

// GET /api/v1/calendar?from=2026-11-01T00:00:00.000Z&to=2026-12-06T23:59:59.000Z
router.get('/', c.getCalendar);

module.exports = router;
