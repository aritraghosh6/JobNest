const express = require('express');
const c = require('../controllers/networkController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect, authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER));

router.get('/', c.getConnections);
router.post('/', c.sendRequest);
router.patch('/:id', c.respondToRequest);
router.delete('/:id', c.removeConnection);

module.exports = router;
