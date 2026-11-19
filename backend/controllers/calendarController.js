const Job = require('../models/Job');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const Follow = require('../models/Follow');
const SeekerProfile = require('../models/SeekerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const { companyUserIds } = require('../services/companyGroup');

/**
 * Calendar for job seekers and employers.
 * GET /api/v1/calendar?from=ISO&to=ISO   (the visible month; max 100 days)
 *
 * Returns { events, todo, pipeline? } built only from the logged-in user's own data.
 * Every event: { id, type, date, title, subtitle, link, highlight, done }
 */

const DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 3; // deadlines are highlighted from 3 days before

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();

/** True when the job title contains one of the roles the seeker is looking for (whole words). */
function matchesRole(title, roles) {
  const t = ` ${norm(title)} `;
  return roles.some((r) => {
    const n = norm(r);
    return n && t.includes(` ${n} `);
  });
}

const inRange = (date, from, to) => date && date >= from && date <= to;
const isSoon = (date, now) => Boolean(date) && date >= now && daysUntil(date, now) <= SOON_DAYS;
const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** Whole calendar days from today until the date (0 = today). */
const daysUntil = (d, now) => {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
};
const MODE = { online: 'Online', in_person: 'In person', phone: 'Phone' };

function readRange(query) {
  const now = new Date();
  const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = query.to ? new Date(query.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new AppError(400, 'Please give a valid date range.');
  if (to - from > 100 * DAY) throw new AppError(400, 'The date range can be at most 100 days.');
  return { from, to, now };
}

// ---------------------------------------------------------------- job seeker
async function seekerCalendar(userId, { from, to, now }) {
  const [profile, follows, saved, applications] = await Promise.all([
    SeekerProfile.findOne({ user: userId }).select('job_preferences.desired_roles'),
    Follow.find({ seeker: userId }).select('employer'),
    SavedJob.find({ seeker: userId }).populate('job'),
    Application.find({ applicant: userId }).populate('job', 'title company_name application_deadline status moderation_status'),
  ]);
  const roles = profile?.job_preferences?.desired_roles || [];
  const appliedJobIds = new Set(applications.map((a) => String(a.job?._id || a.job)));
  const events = [];
  const todo = [];

  // 1. Jobs from followed companies that match a role you want (shown on the day they were posted)
  const followedJobs = follows.length && roles.length
    ? await Job.find({ employer: { $in: (await Promise.all(follows.map((f) => companyUserIds(f.employer)))).flat() }, moderation_status: 'active' })
        .select('title company_name location createdAt application_deadline status')
        .sort({ createdAt: -1 })
        .limit(300)
    : [];
  const wanted = new Map(); // jobs you might apply for (not applied yet): followed + matching, or saved

  followedJobs
    .filter((j) => matchesRole(j.title, roles))
    .forEach((j) => {
      if (inRange(j.createdAt, from, to)) {
        events.push({
          id: `new-${j._id}`,
          type: 'new_job',
          date: j.createdAt,
          title: `${j.company_name} posted ${j.title}`,
          subtitle: `${j.location || ''}${appliedJobIds.has(String(j._id)) ? ' \u00b7 Applied' : ''}`.replace(/^ \u00b7 /, ''),
          link: `/jobs/${j._id}`,
        });
      }
      if (j.status === 'open' && !appliedJobIds.has(String(j._id))) wanted.set(String(j._id), { job: j, reason: 'Company you follow' });
    });
  saved.forEach((s) => {
    if (s.job && s.job.status === 'open' && s.job.moderation_status === 'active' && !appliedJobIds.has(String(s.job._id))) {
      wanted.set(String(s.job._id), { job: s.job, reason: 'Saved job' });
    }
  });

  // 2. Deadlines of jobs you haven't applied for yet - highlighted from 3 days before
  wanted.forEach(({ job, reason }) => {
    const d = job.application_deadline;
    if (!d || d < now) return;
    const soon = isSoon(d, now);
    if (inRange(d, from, to)) {
      events.push({
        id: `dl-${job._id}`,
        type: 'deadline',
        date: d,
        title: `Last day to apply: ${job.title}`,
        subtitle: `${job.company_name} \u00b7 ${reason}`,
        link: `/jobs/${job._id}`,
        highlight: soon,
      });
    }
    if (soon) {
      const days = Math.max(0, daysUntil(d, now));
      todo.push({
        id: `todo-dl-${job._id}`,
        tone: 'danger',
        icon: 'alarm',
        title: `${job.title} closes ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
        subtitle: `${job.company_name} \u00b7 Apply before ${fmtDay(d)}`,
        link: `/jobs/${job._id}`,
        date: d,
      });
    }
  });

  // 3. Your applications: when you applied, their deadlines (not highlighted), and every scheduled step
  applications.forEach((a) => {
    const job = a.job;
    if (!job || !job.title) return;
    if (inRange(a.createdAt, from, to)) {
      events.push({ id: `app-${a._id}`, type: 'applied', date: a.createdAt, title: `Applied to ${job.company_name}`, subtitle: job.title, link: '/applications' });
    }
    if (job.application_deadline && inRange(job.application_deadline, from, to)) {
      events.push({
        id: `adl-${a._id}`,
        type: 'deadline_applied',
        date: job.application_deadline,
        title: `Deadline: ${job.title}`,
        subtitle: `${job.company_name} \u00b7 You already applied`,
        link: '/applications',
        done: true,
      });
    }
    (a.status_history || []).forEach((h, i) => {
      if (h.scheduled_at && ['assessment', 'interview'].includes(h.status)) {
        const label = h.stage_label || (h.status === 'interview' ? 'Interview' : 'Assessment');
        const where = [MODE[h.mode], h.location].filter(Boolean).join(' \u00b7 ');
        const upcoming = h.scheduled_at >= now;
        if (inRange(h.scheduled_at, from, to)) {
          events.push({
            id: `step-${a._id}-${i}`,
            type: h.status,
            date: h.scheduled_at,
            title: `${label}: ${job.title}`,
            subtitle: `${job.company_name} \u00b7 ${fmtTime(h.scheduled_at)}${where ? ` \u00b7 ${where}` : ''}`,
            link: '/applications',
            highlight: upcoming && isSoon(h.scheduled_at, now),
            done: !upcoming,
          });
        }
        if (upcoming && h.scheduled_at - now <= 14 * DAY) {
          todo.push({
            id: `todo-step-${a._id}-${i}`,
            tone: h.status === 'interview' ? 'warning' : 'info',
            icon: h.status === 'interview' ? 'calendar-event' : 'clipboard-check',
            title: `Upcoming ${label.toLowerCase()} for ${job.title}`,
            subtitle: `${job.company_name} \u00b7 ${fmtDay(h.scheduled_at)}, ${fmtTime(h.scheduled_at)}${where ? ` \u00b7 ${where}` : ''}`,
            link: '/applications',
            date: h.scheduled_at,
          });
        }
      }
      if (['shortlisted', 'hired'].includes(h.status) && h.changed_at && inRange(h.changed_at, from, to)) {
        events.push({
          id: `st-${a._id}-${i}`,
          type: h.status === 'hired' ? 'selected' : 'shortlisted',
          date: h.changed_at,
          title: h.status === 'hired' ? `Selected for ${job.title}` : `Shortlisted for ${job.title}`,
          subtitle: job.company_name,
          link: '/applications',
          highlight: h.status === 'hired',
        });
      }
    });
    // Selected or shortlisted but no next step booked yet
    if (['shortlisted'].includes(a.status)) {
      todo.push({ id: `todo-wait-${a._id}`, tone: 'success', icon: 'star', title: `You're shortlisted for ${job.title}`, subtitle: `${job.company_name} will share the next step. Keep an eye on your notifications.`, link: '/applications', date: a.updatedAt });
    }
    if (a.status === 'hired') {
      todo.push({ id: `todo-hired-${a._id}`, tone: 'success', icon: 'trophy', title: `Selected for ${job.title}`, subtitle: `${job.company_name} will contact you with the next steps.`, link: '/applications', date: a.updatedAt });
    }
  });

  todo.sort((x, y) => new Date(x.date) - new Date(y.date));
  return { events, todo };
}

// ---------------------------------------------------------------- employer (HR view)
async function employerCalendar(userId, { from, to, now }) {
  const [jobs, profile] = await Promise.all([
    Job.find({ employer: userId }).select('title status closed_reason application_deadline max_applicants createdAt updatedAt moderation_status'),
    EmployerProfile.findOne({ user: userId }).select('verification.status company_name'),
  ]);
  const jobIds = jobs.map((j) => j._id);
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));
  const applications = jobIds.length
    ? await Application.find({ employer: userId }).populate('applicant', 'name').select('job applicant status status_history createdAt updatedAt')
    : [];
  const events = [];
  const todo = [];
  const pipeline = { submitted: 0, under_review: 0, shortlisted: 0, assessment: 0, interview: 0, hired: 0, rejected: 0 };
  const perJob = new Map(); // job id -> { total, submitted, oldestSubmitted, shortlistedNoStep, hired: [] }

  applications.forEach((a) => {
    if (pipeline[a.status] !== undefined) pipeline[a.status] += 1;
    const key = String(a.job);
    const s = perJob.get(key) || { total: 0, submitted: 0, oldestSubmitted: null, shortlistedNoStep: 0, hired: [] };
    s.total += 1;
    if (a.status === 'submitted') {
      s.submitted += 1;
      if (!s.oldestSubmitted || a.createdAt < s.oldestSubmitted) s.oldestSubmitted = a.createdAt;
    }
    if (a.status === 'shortlisted' && now - a.updatedAt > 3 * DAY) s.shortlistedNoStep += 1;
    if (a.status === 'hired') s.hired.push(a);
    perJob.set(key, s);
  });

  // 1. Your jobs: posted date and closing date (highlighted from 3 days before)
  jobs.forEach((j) => {
    const link = `/employer/jobs/${j._id}/applicants`;
    if (inRange(j.createdAt, from, to)) {
      events.push({ id: `posted-${j._id}`, type: 'posted', date: j.createdAt, title: `Posted ${j.title}`, subtitle: 'Job published', link });
    }
    const d = j.application_deadline;
    if (d && inRange(d, from, to)) {
      events.push({
        id: `close-${j._id}`,
        type: 'deadline',
        date: d,
        title: `${d < now ? 'Applications closed' : 'Applications close'}: ${j.title}`,
        subtitle: `${perJob.get(String(j._id))?.total || 0} applicant(s) so far`,
        link,
        highlight: j.status === 'open' && isSoon(d, now),
        done: d < now,
      });
    }
  });

  // 2. New applications, grouped per job per day
  const groups = new Map();
  applications.forEach((a) => {
    if (!inRange(a.createdAt, from, to)) return;
    const day = new Date(a.createdAt);
    day.setHours(12, 0, 0, 0);
    const key = `${a.job}-${day.toDateString()}`;
    const g = groups.get(key) || { job: a.job, date: day, count: 0 };
    g.count += 1;
    groups.set(key, g);
  });
  groups.forEach((g, key) => {
    const job = jobById.get(String(g.job));
    if (!job) return;
    events.push({ id: `apps-${key}`, type: 'applications', date: g.date, title: `${g.count} new application${g.count === 1 ? '' : 's'}`, subtitle: job.title, link: `/employer/jobs/${job._id}/applicants` });
  });

  // 3. Interviews and assessments you scheduled, and hires
  applications.forEach((a) => {
    const job = jobById.get(String(a.job));
    if (!job) return;
    const name = a.applicant?.name || 'Candidate';
    const link = `/employer/jobs/${job._id}/applicants`;
    (a.status_history || []).forEach((h, i) => {
      if (h.scheduled_at && ['assessment', 'interview'].includes(h.status)) {
        const label = h.stage_label || (h.status === 'interview' ? 'Interview' : 'Assessment');
        const upcoming = h.scheduled_at >= now;
        if (inRange(h.scheduled_at, from, to)) {
          events.push({
            id: `step-${a._id}-${i}`,
            type: h.status,
            date: h.scheduled_at,
            title: `${label} with ${name}`,
            subtitle: `${job.title} \u00b7 ${fmtTime(h.scheduled_at)}${h.mode ? ` \u00b7 ${MODE[h.mode]}` : ''}`,
            link,
            highlight: upcoming && isSoon(h.scheduled_at, now),
            done: !upcoming,
          });
        }
        if (upcoming && h.scheduled_at - now <= 7 * DAY) {
          todo.push({ id: `todo-step-${a._id}-${i}`, tone: 'warning', icon: 'calendar-event', title: `Prepare for ${label.toLowerCase()} with ${name}`, subtitle: `${job.title} \u00b7 ${fmtDay(h.scheduled_at)}, ${fmtTime(h.scheduled_at)}. Review their CV and share the joining details.`, link, date: h.scheduled_at });
        }
      }
      if (h.status === 'hired' && h.changed_at && inRange(h.changed_at, from, to)) {
        events.push({ id: `hire-${a._id}-${i}`, type: 'selected', date: h.changed_at, title: `${name} selected`, subtitle: job.title, link, highlight: true });
      }
    });
  });

  // 4. HR to-do list: what needs attention now
  if (!profile) {
    todo.push({ id: 'todo-profile', tone: 'danger', icon: 'building', title: 'Create your company profile', subtitle: 'Candidates see it on every job you post.', link: '/onboarding', date: now });
  } else if (profile.verification?.status !== 'approved') {
    todo.push({ id: 'todo-verify', tone: 'danger', icon: 'shield-check', title: 'Get your company verified', subtitle: 'You can post jobs after an administrator approves your documents.', link: '/company#verification', date: now });
  }
  jobs.forEach((j) => {
    const s = perJob.get(String(j._id)) || { total: 0, submitted: 0, shortlistedNoStep: 0, hired: [] };
    const link = `/employer/jobs/${j._id}/applicants`;
    const open = j.status === 'open' && j.moderation_status === 'active';
    if (s.submitted > 0) {
      const days = Math.floor((now - s.oldestSubmitted) / DAY);
      todo.push({ id: `todo-review-${j._id}`, tone: days >= 3 ? 'danger' : 'info', icon: 'inbox', title: `Review ${s.submitted} new application${s.submitted === 1 ? '' : 's'} for ${j.title}`, subtitle: days >= 3 ? `The oldest has waited ${days} days. Candidates expect a reply within a week.` : 'Screen CVs and move good matches to "Under review".', link, date: s.oldestSubmitted });
    }
    if (s.shortlistedNoStep > 0) {
      todo.push({ id: `todo-next-${j._id}`, tone: 'warning', icon: 'calendar-plus', title: `Schedule the next step for ${s.shortlistedNoStep} shortlisted candidate${s.shortlistedNoStep === 1 ? '' : 's'}`, subtitle: `${j.title} \u00b7 Book an assessment or interview so they don't lose interest.`, link, date: now });
    }
    if (open && j.application_deadline && isSoon(j.application_deadline, now)) {
      todo.push({ id: `todo-closing-${j._id}`, tone: 'warning', icon: 'hourglass-split', title: `${j.title} closes on ${fmdOrToday(j.application_deadline, now)}`, subtitle: `${s.total} applicant(s). Extend the deadline if you need more, or start shortlisting.`, link: `/employer/jobs/${j._id}/edit`, date: j.application_deadline });
    }
    if (open && j.application_deadline && j.application_deadline < now) {
      todo.push({ id: `todo-expired-${j._id}`, tone: 'danger', icon: 'calendar-x', title: `${j.title}: deadline has passed`, subtitle: 'Close the job or set a new deadline so candidates are not left waiting.', link: `/employer/jobs/${j._id}/edit`, date: j.application_deadline });
    }
    if (open && j.max_applicants && s.total >= 0.8 * j.max_applicants && s.total < j.max_applicants) {
      todo.push({ id: `todo-limit-${j._id}`, tone: 'warning', icon: 'people', title: `${j.title} is nearly full`, subtitle: `${s.total} of ${j.max_applicants} applications received. Raise the limit if you want more.`, link: `/employer/jobs/${j._id}/edit`, date: now });
    }
    if (open && s.total === 0 && now - j.createdAt > 7 * DAY) {
      todo.push({ id: `todo-quiet-${j._id}`, tone: 'info', icon: 'megaphone', title: `No applications yet for ${j.title}`, subtitle: 'Check the title, skills and salary, or share the job with your network.', link: `/employer/jobs/${j._id}/edit`, date: j.createdAt });
    }
    if (s.hired.length && open) {
      todo.push({ id: `todo-filled-${j._id}`, tone: 'success', icon: 'person-check', title: `You've selected someone for ${j.title}`, subtitle: 'Mark the position as filled so the other candidates are told, and start onboarding.', link, date: now });
    }
    s.hired.forEach((a) => {
      if (now - a.updatedAt <= 14 * DAY) {
        todo.push({ id: `todo-onboard-${a._id}`, tone: 'success', icon: 'clipboard2-check', title: `Onboard ${a.applicant?.name || 'your new hire'}`, subtitle: `${j.title} \u00b7 Send the offer letter, collect documents and agree a start date.`, link, date: a.updatedAt });
      }
    });
  });

  const order = { danger: 0, warning: 1, info: 2, success: 3 };
  todo.sort((x, y) => order[x.tone] - order[y.tone] || new Date(x.date) - new Date(y.date));
  return { events, todo, pipeline };
}

function fmdOrToday(d, now) {
  return new Date(d).toDateString() === now.toDateString() ? 'today' : fmtDay(d);
}

// GET /api/v1/calendar
const getCalendar = asyncHandler(async (req, res) => {
  const range = readRange(req.query);
  const data = req.user.role === ROLES.EMPLOYER ? await employerCalendar(req.user._id, range) : await seekerCalendar(req.user._id, range);
  data.events.sort((x, y) => new Date(x.date) - new Date(y.date));
  res.json({ ...data, from: range.from, to: range.to });
});

module.exports = { getCalendar, matchesRole };
