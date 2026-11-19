const express = require('express');
const { discoverUsers } = require('../controllers/networkController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.get('/discover', protect, authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER), discoverUsers);

module.exports = router;
