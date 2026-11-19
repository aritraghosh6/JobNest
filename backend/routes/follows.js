const express = require('express');
const c = require('../controllers/followController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER));

router.get('/', c.listFollowing);
router.post('/:employerId', c.follow);
router.delete('/:employerId', c.unfollow);

module.exports = router;
