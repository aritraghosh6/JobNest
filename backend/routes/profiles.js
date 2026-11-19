const express = require('express');
const c = require('../controllers/profileController');
const { protect, authorize } = require('../middleware/auth');
const { uploadSeekerDocument, uploadLogo, uploadVerificationDocument } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const seekerOrEmployer = authorize(ROLES.JOB_SEEKER, ROLES.EMPLOYER);

router.get('/me', seekerOrEmployer, c.getMyProfile);
router.post('/', seekerOrEmployer, c.createProfile);
router.put('/me', seekerOrEmployer, c.updateMyProfile);

// Job seeker documents (US1)
router.post('/me/documents/:type', authorize(ROLES.JOB_SEEKER), uploadSeekerDocument, c.uploadDocument);
router.get('/me/documents/:type', authorize(ROLES.JOB_SEEKER), c.downloadDocument);
router.delete('/me/documents/:type', authorize(ROLES.JOB_SEEKER), c.deleteDocument);

// Employer logo and verification (US5)
router.post('/me/logo', authorize(ROLES.EMPLOYER), uploadLogo, c.uploadLogo);
router.post('/me/verification', authorize(ROLES.EMPLOYER), uploadVerificationDocument, c.submitVerification);

// Find and join a company that's already registered
router.get('/companies', authorize(ROLES.EMPLOYER), c.searchCompanies);
router.post('/join', authorize(ROLES.EMPLOYER), c.joinCompany);

// Public company page (any logged-in user)
router.get('/companies/:userId', c.getCompanyProfile);

module.exports = router;
