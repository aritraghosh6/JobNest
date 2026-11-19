/**
 * Every backend endpoint used by the React app, grouped by feature.
 * URLs here must match backend/routes/*.js exactly.
 */
import client from './client';

const data = (promise) => promise.then((res) => res.data);

const upload = (url, formData, onProgress) =>
  data(
    client.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => e.total && onProgress(Math.round((e.loaded * 100) / e.total))
        : undefined,
    })
  );

/** Downloads a protected file (the JWT header is sent) and saves it in the browser. */
export async function downloadFile(url, fallbackName = 'download') {
  const res = await client.get(url, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const authApi = {
  sendSignupOtp: (body) => data(client.post('/auth/signup/send-otp', body)),
  signup: (body) => data(client.post('/auth/signup', body)),
  login: (body) => data(client.post('/auth/login', body)),
  me: () => data(client.get('/auth/me')),
  // role: "job_seeker" or "employer" - each account on one email has its own password
  forgotPassword: (email, role) => data(client.post('/auth/forgot-password', { email, role })),
  resetPassword: (body) => data(client.post('/auth/reset-password', body)),
};

export const profileApi = {
  getMine: () => data(client.get('/profiles/me')),
  create: (body) => data(client.post('/profiles', body)),
  update: (body) => data(client.put('/profiles/me', body)),
  uploadDocument: (type, file, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    return upload(`/profiles/me/documents/${type}`, fd, onProgress);
  },
  deleteDocument: (type) => data(client.delete(`/profiles/me/documents/${type}`)),
  downloadDocument: (type) => downloadFile(`/profiles/me/documents/${type}`, `${type}.pdf`),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return upload('/profiles/me/logo', fd);
  },
  submitVerification: (registrationNumber, file) => {
    const fd = new FormData();
    fd.append('registration_number', registrationNumber);
    fd.append('document', file);
    return upload('/profiles/me/verification', fd);
  },
  getCompany: (userId) => data(client.get(`/profiles/companies/${userId}`)),
  // Employers: find a company that's already registered, and join it instead of creating a duplicate
  searchCompanies: (q) => data(client.get('/profiles/companies', { params: q ? { q } : {} })),
  joinCompany: (companyId) => data(client.post('/profiles/join', { company_id: companyId })),
};

export const assessmentApi = {
  questions: () => data(client.get('/assessments/questions')),
  submit: (answers) => data(client.post('/assessments/submit', { answers })),
  latest: () => data(client.get('/assessments/latest')),
  history: () => data(client.get('/assessments/history')),
  byId: (id) => data(client.get(`/assessments/${id}`)),
};

export const jobApi = {
  matched: (params) => data(client.get('/jobs', { params })),
  mine: () => data(client.get('/jobs/mine')),
  get: (id) => data(client.get(`/jobs/${id}`)),
  create: (body) => data(client.post('/jobs', body)),
  update: (id, body) => data(client.put(`/jobs/${id}`, body)),
  setStatus: (id, status) => data(client.patch(`/jobs/${id}/status`, { status })),
  remove: (id) => data(client.delete(`/jobs/${id}`)),
  apply: (id, body) => data(client.post(`/jobs/${id}/apply`, body)),
  applications: (id) => data(client.get(`/jobs/${id}/applications`)),
  markFilled: (id, message) => data(client.patch(`/jobs/${id}/fill`, { message })),
  save: (id) => data(client.post(`/jobs/${id}/save`)),
  unsave: (id) => data(client.delete(`/jobs/${id}/save`)),
  saved: () => data(client.get('/jobs/saved')),
};

export const applicationApi = {
  mine: (params) => data(client.get('/applications/mine', { params })),
  get: (id) => data(client.get(`/applications/${id}`)),
  // extra: a note string, or { note, stage_label, scheduled_at, mode, location }
  setStatus: (id, status, extra) =>
    data(client.patch(`/applications/${id}/status`, { status, ...(typeof extra === 'string' ? { note: extra } : extra || {}) })),
  withdraw: (id) => data(client.patch(`/applications/${id}/withdraw`)),
  downloadResume: (id) => downloadFile(`/applications/${id}/resume`, 'resume.pdf'),
};

export const notificationApi = {
  list: (params) => data(client.get('/notifications', { params })),
  unreadCount: () => data(client.get('/notifications/unread-count')),
  markRead: (id) => data(client.patch(`/notifications/${id}/read`)),
  // category: 'messages' | 'jobs' | 'applications'; leave empty to mark everything as read
  markAllRead: (category) => data(client.patch('/notifications/read-all', null, { params: category ? { category } : {} })),
  remove: (id) => data(client.delete(`/notifications/${id}`)),
};

export const calendarApi = {
  // params: { from, to } as ISO dates (the visible month)
  get: (params) => data(client.get('/calendar', { params })),
};

export const followApi = {
  list: () => data(client.get('/follows')),
  follow: (employerId) => data(client.post(`/follows/${employerId}`)),
  unfollow: (employerId) => data(client.delete(`/follows/${employerId}`)),
};

export const networkApi = {
  discover: (params) => data(client.get('/users/discover', { params })),
  connections: () => data(client.get('/connections')),
  connect: (userId) => data(client.post('/connections', { user_id: userId })),
  respond: (id, action) => data(client.patch(`/connections/${id}`, { action })),
  remove: (id) => data(client.delete(`/connections/${id}`)),
};

export const messageApi = {
  conversations: () => data(client.get('/messages/conversations')),
  thread: (userId) => data(client.get(`/messages/${userId}`)),
  send: (recipientId, message) => data(client.post('/messages', { recipient_id: recipientId, message })),
  unreadCount: () => data(client.get('/messages/unread-count')),
};

export const resumeApi = {
  // Every open job (matched ones first) for the ATS checker's job list
  jobs: () => data(client.get('/resumes/jobs')),
  analyze: ({ file, jobId, jobDescription, jobTitle }, onProgress) => {
    const fd = new FormData();
    fd.append('resume', file);
    if (jobId) fd.append('job_id', jobId);
    else {
      fd.append('job_description', jobDescription);
      if (jobTitle) fd.append('job_title', jobTitle);
    }
    return upload('/resumes/analyze', fd, onProgress);
  },
  history: () => data(client.get('/resumes/history')),
  get: (id) => data(client.get(`/resumes/history/${id}`)),
  remove: (id) => data(client.delete(`/resumes/history/${id}`)),
};

export const adminApi = {
  stats: () => data(client.get('/admin/stats')),
  users: (params) => data(client.get('/admin/users', { params })),
  setUserStatus: (id, isActive) => data(client.patch(`/admin/users/${id}/status`, { is_active: isActive })),
  employers: (params) => data(client.get('/admin/employers', { params })),
  reviewEmployer: (id, status, note) => data(client.patch(`/admin/employers/${id}/verification`, { status, note })),
  downloadVerification: (id) => downloadFile(`/admin/employers/${id}/document`, 'verification-document'),
  jobs: (params) => data(client.get('/admin/jobs', { params })),
  moderateJob: (id, status, note) => data(client.patch(`/admin/jobs/${id}/moderation`, { moderation_status: status, note })),
};
