const express = require('express');
const c = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER));

router.post('/', c.sendMessage);
router.get('/conversations', c.getConversations);
router.get('/unread-count', c.getUnreadCount);
router.get('/:userId', c.getThread);

module.exports = router;
