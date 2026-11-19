const SeekerProfile = require('../models/SeekerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, CULTURE_TAGS, EMPLOYMENT_TYPES, COMPANY_SIZES, CAREER_STATUSES, NOTICE_PERIODS } = require('../config/constants');
const {
  cleanString,
  toStringArray,
  toNumber,
  isUrl,
  throwIfErrors,
  assertValidId,
} = require('../utils/validators');
const { assertUploadedFile, fileMeta, removeFile, storedPath, sendStoredFile } = require('../utils/files');
const { companyKey } = require('../services/companyGroup');
const { FREE_PROVIDERS } = require('../services/emailCheck');
const { notify } = require('../services/notificationService');

/* ---------- Serialisers: decide what is returned to the browser ---------- */

const fileInfo = (meta) =>
  meta && meta.stored_name
    ? { original_name: meta.original_name, size: meta.size, mimetype: meta.mimetype, uploaded_at: meta.uploaded_at }
    : null;

function serializeSeeker(profile) {
  const obj = profile.toObject();
  obj.resume = fileInfo(profile.resume);
  obj.cover_letter = fileInfo(profile.cover_letter);
  delete obj.__v;
  return obj;
}

const logoUrl = (profile) => (profile.logo && profile.logo.stored_name ? `/uploads/logos/${profile.logo.stored_name}` : null);

function serializeEmployer(profile, { isOwner = false, isAdmin = false } = {}) {
  const obj = profile.toObject();
  delete obj.__v;
  delete obj.logo;
  obj.logo_url = logoUrl(profile);
  if (isOwner || isAdmin) {
    obj.verification = {
      ...obj.verification,
      document: fileInfo(profile.verification?.document),
    };
  } else {
    // Public view: only the status is shown
    obj.verification = { status: profile.verification?.status || 'not_submitted' };
  }
  return obj;
}

/* ---------- Input builders: copy only allowed fields from the request ---------- */

function buildSeekerData(body) {
  const errors = {};
  const prefs = body.job_preferences || {};
  const social = body.social_links || {};

  const data = {
    full_name: cleanString(body.full_name, 100),
    phone: cleanString(body.phone, 20),
    location: cleanString(body.location, 100),
    headline: cleanString(body.headline, 120),
    summary: cleanString(body.summary, 1500),
    skills: toStringArray(body.skills, 50, 50),
    education: (Array.isArray(body.education) ? body.education : []).slice(0, 10).map((e) => ({
      institution: cleanString(e.institution, 150),
      degree: cleanString(e.degree, 100),
      field_of_study: cleanString(e.field_of_study, 100),
      start_year: toNumber(e.start_year),
      end_year: toNumber(e.end_year),
      grade: cleanString(e.grade, 30),
    })),
    experience: (Array.isArray(body.experience) ? body.experience : []).slice(0, 15).map((e) => ({
      title: cleanString(e.title, 100),
      organization: cleanString(e.organization, 150),
      type: ['job', 'internship', 'project'].includes(e.type) ? e.type : 'job',
      start_date: e.start_date || undefined,
      end_date: e.is_current ? undefined : e.end_date || undefined,
      is_current: Boolean(e.is_current),
      description: cleanString(e.description, 1000),
    })),
    job_preferences: {
      desired_roles: toStringArray(prefs.desired_roles, 10, 80),
      preferred_locations: toStringArray(prefs.preferred_locations, 10, 80),
      job_types: toStringArray(prefs.job_types, 4).filter((t) => EMPLOYMENT_TYPES.includes(t)),
      expected_salary: toNumber(prefs.expected_salary),
      open_to_remote: Boolean(prefs.open_to_remote),
    },
    social_links: {
      linkedin: cleanString(social.linkedin, 200),
      github: cleanString(social.github, 200),
      portfolio: cleanString(social.portfolio, 200),
    },
  };

  // Fields added by the profile setup wizard. Only touched when the request sends them,
  // so saving from the older profile page never erases them.
  if ('current_status' in body) data.current_status = CAREER_STATUSES.includes(body.current_status) ? body.current_status : undefined;
  if ('notice_period' in body) data.notice_period = NOTICE_PERIODS.includes(body.notice_period) ? body.notice_period : undefined;
  if ('experience_years' in body) {
    data.experience_years = toNumber(body.experience_years);
    if (Number.isNaN(data.experience_years)) errors.experience_years = 'Years of experience must be a number.';
  }

  for (const [key, value] of Object.entries(data.social_links)) {
    if (value && !isUrl(value)) errors[`social_links.${key}`] = 'Please enter a full URL starting with http:// or https://';
  }
  if (Number.isNaN(data.job_preferences.expected_salary)) errors['job_preferences.expected_salary'] = 'Expected salary must be a number.';
  data.education.forEach((e, i) => {
    if (Number.isNaN(e.start_year) || Number.isNaN(e.end_year)) errors[`education.${i}`] = 'Years must be numbers.';
  });
  throwIfErrors(errors);
  return data;
}

function buildEmployerData(body) {
  const errors = {};
  const prefs = body.job_preferences || {};
  const data = {
    company_name: cleanString(body.company_name, 120),
    industry: cleanString(body.industry, 80),
    location: cleanString(body.location, 100),
    website: cleanString(body.website, 200),
    company_size: COMPANY_SIZES.includes(body.company_size) ? body.company_size : undefined,
    company_description: cleanString(body.company_description, 2000),
    culture_description: cleanString(body.culture_description, 2000),
    values: toStringArray(body.values, 10, 60),
    culture_tags: toStringArray(body.culture_tags, 5).filter((t) => CULTURE_TAGS.includes(t)),
    job_preferences: {
      required_skills: toStringArray(prefs.required_skills, 30, 50),
      salary_range: cleanString(prefs.salary_range, 60),
    },
  };
  if (data.website && !isUrl(data.website)) errors.website = 'Please enter a full URL starting with http:// or https://';
  // Fields added by the profile setup wizard (only touched when sent)
  if ('contact_designation' in body) data.contact_designation = cleanString(body.contact_designation, 80);
  if ('contact_phone' in body) data.contact_phone = cleanString(body.contact_phone, 20);
  if ('founded_year' in body) {
    data.founded_year = toNumber(body.founded_year);
    if (Number.isNaN(data.founded_year)) errors.founded_year = 'Year founded must be a number.';
  }
  throwIfErrors(errors);
  return data;
}

/* ---------- Handlers ---------- */

// GET /api/v1/profiles/me
const getMyProfile = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.JOB_SEEKER) {
    const profile = await SeekerProfile.findOne({ user: req.user._id });
    return res.json({ profile: profile ? serializeSeeker(profile) : null });
  }
  if (req.user.role === ROLES.EMPLOYER) {
    const profile = await EmployerProfile.findOne({ user: req.user._id });
    return res.json({ profile: profile ? serializeEmployer(profile, { isOwner: true }) : null });
  }
  throw new AppError(400, 'Admins do not have a profile.');
});

// POST /api/v1/profiles
const createProfile = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;
  if (role === ROLES.JOB_SEEKER) {
    if (await SeekerProfile.exists({ user: _id })) throw new AppError(409, 'You already have a profile. Use update instead.');
    const profile = await SeekerProfile.create({ ...buildSeekerData(req.body), user: _id });
    await User.updateOne({ _id }, { profile_completed: true });
    return res.status(201).json({ message: 'Profile created successfully', profile: serializeSeeker(profile) });
  }
  if (role === ROLES.EMPLOYER) {
    if (await EmployerProfile.exists({ user: _id })) throw new AppError(409, 'You already have a company profile. Use update instead.');
    const data = buildEmployerData(req.body);
    // One company, one profile: if it's already registered, colleagues join it instead
    const existing = await EmployerProfile.findOne({ company_key: companyKey(data.company_name), joined_company: { $exists: false } }).select('_id company_name');
    if (existing) {
      throw new AppError(409, `${existing.company_name} is already registered on JobNest. Search for it and join it instead.`, {
        code: 'COMPANY_EXISTS',
        company_id: existing._id,
        company_name: existing.company_name,
      });
    }
    const profile = await EmployerProfile.create({ ...data, user: _id });
    await User.updateOne({ _id }, { profile_completed: true });
    return res.status(201).json({ message: 'Profile created successfully', profile: serializeEmployer(profile, { isOwner: true }) });
  }
  throw new AppError(403, 'Admins cannot create a profile.');
});

// PUT /api/v1/profiles/me
const updateMyProfile = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;
  if (role === ROLES.JOB_SEEKER) {
    const profile = await SeekerProfile.findOne({ user: _id });
    if (!profile) throw new AppError(404, 'Profile not found. Please create your profile first.');
    profile.set(buildSeekerData(req.body));
    await profile.save();
    return res.json({ message: 'Profile updated successfully', profile: serializeSeeker(profile) });
  }
  if (role === ROLES.EMPLOYER) {
    const profile = await EmployerProfile.findOne({ user: _id });
    if (!profile) throw new AppError(404, 'Company profile not found. Please create it first.');
    profile.set(buildEmployerData(req.body));
    await profile.save();
    return res.json({ message: 'Profile updated successfully', profile: serializeEmployer(profile, { isOwner: true }) });
  }
  throw new AppError(403, 'Admins do not have a profile.');
});

const DOC_TYPES = ['resume', 'cover_letter'];

// POST /api/v1/profiles/me/documents/:type   (multipart field "file")
const uploadDocument = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!DOC_TYPES.includes(type)) {
    removeFile(req.file?.path);
    throw new AppError(400, 'Document type must be resume or cover_letter.');
  }
  assertUploadedFile(req.file);
  const profile = await SeekerProfile.findOne({ user: req.user._id });
  if (!profile) {
    removeFile(req.file.path);
    throw new AppError(400, 'Please create your profile before uploading documents.');
  }
  if (profile[type]?.stored_name) removeFile(storedPath('documents', profile[type].stored_name));
  profile[type] = fileMeta(req.file);
  await profile.save();
  res.json({
    message: `${type === 'resume' ? 'Resume' : 'Cover letter'} uploaded successfully`,
    profile: serializeSeeker(profile),
  });
});

// DELETE /api/v1/profiles/me/documents/:type
const deleteDocument = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!DOC_TYPES.includes(type)) throw new AppError(400, 'Document type must be resume or cover_letter.');
  const profile = await SeekerProfile.findOne({ user: req.user._id });
  if (!profile || !profile[type]?.stored_name) throw new AppError(404, 'Document not found.');
  removeFile(storedPath('documents', profile[type].stored_name));
  profile[type] = undefined;
  await profile.save();
  res.json({ message: 'Document removed', profile: serializeSeeker(profile) });
});

// GET /api/v1/profiles/me/documents/:type
const downloadDocument = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!DOC_TYPES.includes(type)) throw new AppError(400, 'Document type must be resume or cover_letter.');
  const profile = await SeekerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError(404, 'Profile not found.');
  sendStoredFile(res, 'documents', profile[type]);
});

// POST /api/v1/profiles/me/logo   (multipart field "logo")
const uploadLogo = asyncHandler(async (req, res) => {
  assertUploadedFile(req.file);
  const profile = await EmployerProfile.findOne({ user: req.user._id });
  if (!profile) {
    removeFile(req.file.path);
    throw new AppError(400, 'Please create your company profile before uploading a logo.');
  }
  if (profile.logo?.stored_name) removeFile(storedPath('logos', profile.logo.stored_name));
  profile.logo = fileMeta(req.file);
  await profile.save();
  res.json({ message: 'Logo uploaded successfully', profile: serializeEmployer(profile, { isOwner: true }) });
});

// POST /api/v1/profiles/me/verification   (multipart: registration_number + "document")
const submitVerification = asyncHandler(async (req, res) => {
  const registrationNumber = cleanString(req.body.registration_number, 50);
  const profile = await EmployerProfile.findOne({ user: req.user._id });
  const fail = (status, message, details) => {
    removeFile(req.file?.path);
    throw new AppError(status, message, details);
  };
  if (!profile) fail(400, 'Please create your company profile first.');
  if (profile.verification.status === 'pending') fail(409, 'Your verification is already under review.');
  if (profile.verification.status === 'approved') fail(409, 'Your company is already verified.');
  if (!registrationNumber || !/^[A-Za-z0-9\-/ ]{5,50}$/.test(registrationNumber)) {
    fail(400, 'Please correct the highlighted fields.', {
      registration_number: 'Enter a valid company registration number (CIN/GSTIN/etc., 5-50 letters or digits).',
    });
  }
  assertUploadedFile(req.file);

  if (profile.verification.document?.stored_name) {
    removeFile(storedPath('verification', profile.verification.document.stored_name));
  }
  profile.verification = {
    status: 'pending',
    registration_number: registrationNumber,
    document: fileMeta(req.file),
    submitted_at: new Date(),
  };
  await profile.save();
  res.json({
    message: 'Verification submitted. An administrator will review it shortly.',
    profile: serializeEmployer(profile, { isOwner: true }),
  });
});

// GET /api/v1/profiles/companies/:userId   (public company page for any logged-in user)
const getCompanyProfile = asyncHandler(async (req, res) => {
  assertValidId(req.params.userId, 'company id');
  const profile = await EmployerProfile.findOne({ user: req.params.userId });
  if (!profile) throw new AppError(404, 'Company profile not found.');
  res.json({
    profile: serializeEmployer(profile, {
      isOwner: String(profile.user) === String(req.user._id),
      isAdmin: req.user.role === ROLES.ADMIN,
    }),
  });
});

/* ---------- Find and join a company that is already registered ---------- */

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/v1/profiles/companies?q=info   (employers: search registered companies by name)
const searchCompanies = asyncHandler(async (req, res) => {
  const q = cleanString(req.query.q, 80);
  const filter = { joined_company: { $exists: false } };
  if (q) filter.company_name = new RegExp(escapeRegex(q), 'i');
  else filter['verification.status'] = 'approved';
  const companies = await EmployerProfile.find(filter)
    .select('company_name industry location logo verification.status')
    .sort({ 'verification.status': 1, company_name: 1 })
    .limit(q ? 12 : 8);
  const counts = await EmployerProfile.aggregate([
    { $match: { joined_company: { $in: companies.map((c) => c._id) }, 'verification.status': 'approved' } },
    { $group: { _id: '$joined_company', n: { $sum: 1 } } },
  ]);
  const members = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({
    companies: companies.map((c) => ({
      id: c._id,
      company_name: c.company_name,
      industry: c.industry,
      location: c.location,
      logo_url: logoUrl(c),
      verified: c.verification?.status === 'approved',
      members: 1 + (members.get(String(c._id)) || 0),
    })),
  });
});

const domainOf = (email) => String(email || '').split('@')[1]?.toLowerCase() || '';

// POST /api/v1/profiles/join   body: { company_id }
// Creates this employer's profile as a member of an existing company.
// Approved straight away when the work email matches the company's domain
// (e.g. both @infosys.com) and the company is verified; otherwise an administrator reviews it.
const joinCompany = asyncHandler(async (req, res) => {
  assertValidId(req.body.company_id, 'company id');
  if (await EmployerProfile.exists({ user: req.user._id })) {
    throw new AppError(409, 'You already have a company profile.');
  }
  const company = await EmployerProfile.findOne({ _id: req.body.company_id, joined_company: { $exists: false } }).populate('user', 'email');
  if (!company) throw new AppError(404, 'Company not found.');

  const myDomain = domainOf(req.user.email);
  const sameDomain =
    myDomain && !FREE_PROVIDERS.has(myDomain) && myDomain === domainOf(company.user?.email) && company.verification?.status === 'approved';

  const copy = company.toObject();
  const profile = await EmployerProfile.create({
    user: req.user._id,
    company_name: copy.company_name,
    industry: copy.industry,
    location: copy.location,
    website: copy.website,
    founded_year: copy.founded_year,
    company_size: copy.company_size,
    company_description: copy.company_description,
    culture_description: copy.culture_description,
    values: copy.values,
    culture_tags: copy.culture_tags,
    job_preferences: copy.job_preferences,
    logo: copy.logo,
    joined_company: company._id,
    joined_company_name: copy.company_name,
    verification: sameDomain
      ? { status: 'approved', registration_number: copy.verification?.registration_number, submitted_at: new Date(), reviewed_at: new Date(), review_note: 'Approved automatically: work email matches the company.' }
      : { status: 'pending', registration_number: copy.verification?.registration_number, submitted_at: new Date(), review_note: `Request to join ${copy.company_name}.` },
  });
  await User.updateOne({ _id: req.user._id }, { profile_completed: true });

  if (!sameDomain) {
    const admins = await User.find({ role: ROLES.ADMIN, is_active: true }).select('_id');
    await notify(admins.map((a) => a._id), {
      type: 'system',
      title: `${req.user.name} wants to join ${copy.company_name}`,
      message: `${req.user.email} asked to join an existing company. Please review it under Verifications.`,
      link: '/admin',
    });
  }
  await notify(company.user?._id, {
    type: 'system',
    title: `${req.user.name} joined ${copy.company_name} on JobNest`,
    message: sameDomain ? 'They can now post jobs for your company.' : 'An administrator will confirm them before they can post jobs.',
    link: '/company',
  });

  res.status(201).json({
    message: sameDomain
      ? `You've joined ${copy.company_name}. You can post jobs now.`
      : `Request sent. An administrator will confirm that you work at ${copy.company_name}, then you can post jobs.`,
    profile: serializeEmployer(profile, { isOwner: true }),
  });
});

module.exports = {
  searchCompanies,
  joinCompany,
  getMyProfile,
  createProfile,
  updateMyProfile,
  uploadDocument,
  deleteDocument,
  downloadDocument,
  uploadLogo,
  submitVerification,
  getCompanyProfile,
  serializeEmployer,
  serializeSeeker,
};
