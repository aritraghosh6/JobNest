/** Shared labels and formatting helpers. Values must match backend/config/constants.js. */

export const ROLES = { JOB_SEEKER: 'job_seeker', EMPLOYER: 'employer', ADMIN: 'admin' };

export const ROLE_LABELS = { job_seeker: 'Job seeker', employer: 'Employer', admin: 'Administrator' };

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
];

export const CULTURE_TAGS = [
  { value: 'collaborative', label: 'Collaborative', hint: 'Teamwork and open discussion' },
  { value: 'structured', label: 'Structured', hint: 'Clear processes and planning' },
  { value: 'innovative', label: 'Innovative', hint: 'Experimenting and new ideas' },
  { value: 'fast_paced', label: 'Fast-paced', hint: 'Deadlines and multitasking' },
  { value: 'independent', label: 'Independent', hint: 'Ownership and autonomy' },
];

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export const APPLICATION_STATUS = {
  submitted: { label: 'Application submitted', short: 'Submitted', color: 'secondary', icon: 'send' },
  under_review: { label: 'Under review', short: 'In review', color: 'info', icon: 'eye' },
  shortlisted: { label: 'Shortlisted', short: 'Shortlisted', color: 'primary', icon: 'star' },
  assessment: { label: 'Assessment', short: 'Assessment', color: 'warning', icon: 'clipboard-check' },
  interview: { label: 'Interview', short: 'Interview', color: 'warning', icon: 'calendar-event' },
  hired: { label: 'Selected', short: 'Selected', color: 'success', icon: 'trophy' },
  rejected: { label: 'Not selected', short: 'Not selected', color: 'danger', icon: 'x-circle' },
  withdrawn: { label: 'Withdrawn', short: 'Withdrawn', color: 'dark', icon: 'arrow-counterclockwise' },
  position_filled: { label: 'Position filled', short: 'Filled', color: 'dark', icon: 'person-check' },
};

// Mirrors APPLICATION_TRANSITIONS on the backend (employer-side options)
export const EMPLOYER_NEXT_STATUS = {
  submitted: ['under_review', 'shortlisted', 'rejected'],
  under_review: ['shortlisted', 'assessment', 'interview', 'rejected'],
  shortlisted: ['assessment', 'interview', 'rejected'],
  assessment: ['assessment', 'interview', 'rejected'],
  interview: ['interview', 'assessment', 'hired', 'rejected'],
};

export const ACTIVE_STATUSES = ['submitted', 'under_review', 'shortlisted', 'assessment', 'interview'];

export const INTERVIEW_MODES = [
  { value: 'online', label: 'Online (video call)', icon: 'camera-video' },
  { value: 'in_person', label: 'In person', icon: 'geo-alt' },
  { value: 'phone', label: 'Phone call', icon: 'telephone' },
];

export const VERIFICATION = {
  not_submitted: { label: 'Not submitted', color: 'secondary', icon: 'shield' },
  pending: { label: 'Pending review', color: 'warning', icon: 'hourglass-split' },
  approved: { label: 'Verified', color: 'success', icon: 'patch-check-fill' },
  rejected: { label: 'Rejected', color: 'danger', icon: 'shield-x' },
};

export const typeLabel = (value) => EMPLOYMENT_TYPES.find((t) => t.value === value)?.label || value;
export const cultureLabel = (value) => CULTURE_TAGS.find((t) => t.value === value)?.label || value;

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const modeLabel = (value) => INTERVIEW_MODES.find((m) => m.value === value)?.label || value;

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date */
export function timeAgo(value) {
  if (!value) return '';
  const s = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} day${s < 2 * 86400 ? '' : 's'} ago`;
  return formatDate(value);
}

export const formatMoney = (value) =>
  typeof value === 'number' ? `\u20B9${value.toLocaleString('en-IN')}` : '-';

export const formatSize = (bytes) => (bytes ? `${(bytes / 1024).toFixed(0)} KB` : '');

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

/** Readable message from an Axios error (backend sends { error, details }). */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the JobNest server. Is the backend running on port 5000?';
  if (err?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  return err?.message || fallback;
}

/** Field-level errors from the backend, e.g. { email: "..." } */
export const getFieldErrors = (err) => {
  const details = err?.response?.data?.details;
  return details && typeof details === 'object' && !Array.isArray(details) ? details : {};
};

export const getErrorCode = (err) => err?.response?.data?.details?.code;

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

export const isUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Icon and colour for each kind of notification. */
export const NOTIFICATION_META = {
  message: { icon: 'chat-dots-fill', color: 'info', label: 'Message', category: 'messages' },
  application_update: { icon: 'arrow-repeat', color: 'info', label: 'Application update', category: 'applications' },
  assessment: { icon: 'clipboard-check', color: 'warning', label: 'Assessment', category: 'applications' },
  interview: { icon: 'calendar-event', color: 'warning', label: 'Interview', category: 'applications' },
  offer: { icon: 'trophy', color: 'success', label: 'Selected', category: 'applications' },
  rejection: { icon: 'x-circle', color: 'danger', label: 'Decision', category: 'applications' },
  position_filled: { icon: 'person-check', color: 'secondary', label: 'Position filled', category: 'applications' },
  new_application: { icon: 'person-plus', color: 'primary', label: 'New applicant', category: 'applications' },
  applicant_limit: { icon: 'exclamation-triangle', color: 'warning', label: 'Applicant limit', category: 'applications' },
  new_job: { icon: 'briefcase', color: 'primary', label: 'New job', category: 'jobs' },
  followed_company_job: { icon: 'building', color: 'primary', label: 'Company you follow', category: 'jobs' },
  deadline: { icon: 'alarm', color: 'danger', label: 'Deadline', category: 'jobs' },
  system: { icon: 'info-circle', color: 'secondary', label: 'Update', category: 'other' },
};

/** Filter tabs shown in the notification bell and on the Notifications page. */
export const NOTIFICATION_TABS = [
  { key: 'all', label: 'All', icon: 'inbox' },
  { key: 'messages', label: 'Messages', icon: 'chat-dots' },
  { key: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { key: 'applications', label: 'Applications', icon: 'send-check' },
];

/** Tells other parts of the app (e.g. the bell) to refresh straight away. */
export const NOTIFICATIONS_CHANGED = 'jobnest:notifications-changed';
export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));


/**
 * Deadline wording in the right tense:
 *   future -> "Closes 12 Nov 2026" (or "Closes today" / "Closes tomorrow")
 *   past   -> "Closed 7 Nov 2026"
 * Returns { text, past, soon, daysLeft }; soon = 3 days or fewer to go.
 */
export const deadlineInfo = (date, { prefix = "Closes", pastPrefix = "Closed" } = {}) => {
  if (!date) return { text: "No deadline", past: false, soon: false, daysLeft: null };
  const end = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(end);
  day.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((day - today) / 86400000);
  const past = end < new Date();
  if (past) return { text: `${pastPrefix} ${formatDate(end)}`, past: true, soon: false, daysLeft };
  if (daysLeft === 0) return { text: `${prefix} today`, past: false, soon: true, daysLeft };
  if (daysLeft === 1) return { text: `${prefix} tomorrow`, past: false, soon: true, daysLeft };
  return { text: `${prefix} ${formatDate(end)}`, past: false, soon: daysLeft <= 3, daysLeft };
};

/** When the candidate withdrew (from the status history), or null. */
export const withdrawnAt = (history = []) => {
  const entry = [...history].reverse().find((h) => h.status === "withdrawn");
  return entry ? entry.changed_at || entry.createdAt || null : null;
};
