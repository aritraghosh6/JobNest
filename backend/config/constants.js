const ROLES = Object.freeze({
  JOB_SEEKER: 'job_seeker',
  EMPLOYER: 'employer',
  ADMIN: 'admin',
});

// Roles allowed in public sign-up. Admins are created with "npm run create-admin".
const PUBLIC_ROLES = [ROLES.JOB_SEEKER, ROLES.EMPLOYER];

// Work-style dimensions measured by the personality assessment.
// Employers tag their culture and jobs with the same values, which makes cultural fit comparable.
const CULTURE_TAGS = ['collaborative', 'structured', 'innovative', 'fast_paced', 'independent'];

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'internship', 'contract'];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

// Asked in the job seeker profile setup
const CAREER_STATUSES = ['student', 'fresher', 'working', 'career_break'];
const NOTICE_PERIODS = ['immediate', '15_days', '30_days', '60_days', '90_days'];

const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'shortlisted',
  'assessment', // assignment / test set by the employer
  'interview',
  'hired',
  'rejected',
  'withdrawn',
  'position_filled', // the employer filled the role with another candidate
];

// Which status changes are allowed. Terminal statuses have no next step.
// "interview -> interview" allows several rounds (e.g. technical, then HR).
const APPLICATION_TRANSITIONS = {
  submitted: ['under_review', 'shortlisted', 'rejected', 'withdrawn'],
  under_review: ['shortlisted', 'assessment', 'interview', 'rejected', 'withdrawn'],
  shortlisted: ['assessment', 'interview', 'rejected', 'withdrawn'],
  assessment: ['assessment', 'interview', 'rejected', 'withdrawn'],
  interview: ['interview', 'assessment', 'hired', 'rejected', 'withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
  position_filled: [],
};

// Applications that are still being considered
const ACTIVE_APPLICATION_STATUSES = ['submitted', 'under_review', 'shortlisted', 'assessment', 'interview'];

const INTERVIEW_MODES = ['online', 'in_person', 'phone'];

const NOTIFICATION_TYPES = [
  'message',
  'application_update',
  'assessment',
  'interview',
  'offer',
  'rejection',
  'position_filled',
  'new_application',
  'applicant_limit',
  'new_job',
  'followed_company_job',
  'deadline',
  'system',
];

const VERIFICATION_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];

// A job is shown to a seeker only if at least one required skill matches
// AND the overall match score reaches this value (0-100).
const MATCH_THRESHOLD = 40;

/** Groups used by the notification filters (All / Messages / Jobs / Applications). */
const NOTIFICATION_CATEGORIES = {
  messages: ['message'],
  jobs: ['new_job', 'followed_company_job', 'deadline'],
  applications: [
    'application_update',
    'assessment',
    'interview',
    'offer',
    'rejection',
    'position_filled',
    'new_application',
    'applicant_limit',
  ],
};

module.exports = {
  NOTIFICATION_CATEGORIES,
  ROLES,
  PUBLIC_ROLES,
  CULTURE_TAGS,
  EMPLOYMENT_TYPES,
  COMPANY_SIZES,
  CAREER_STATUSES,
  NOTICE_PERIODS,
  APPLICATION_STATUSES,
  APPLICATION_TRANSITIONS,
  ACTIVE_APPLICATION_STATUSES,
  INTERVIEW_MODES,
  NOTIFICATION_TYPES,
  VERIFICATION_STATUSES,
  MATCH_THRESHOLD,
};
