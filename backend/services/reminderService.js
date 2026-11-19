const Job = require('../models/Job');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const Follow = require('../models/Follow');
const SeekerProfile = require('../models/SeekerProfile');
const { notify } = require('./notificationService');

const HOUR = 60 * 60 * 1000;
const REMIND_BEFORE = 72 * HOUR; // remind three days before the deadline

const words = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 2);

/**
 * Finds open jobs whose application deadline is within 3 days and reminds,
 * once per job, the seekers who have not applied yet but saved the job,
 * follow the company, or are looking for a role with a matching title.
 * The employer is also told that the job is about to close.
 */
async function sendDeadlineReminders(now = new Date()) {
  const jobs = await Job.find({
    status: 'open',
    moderation_status: 'active',
    deadline_reminder_sent: { $ne: true },
    application_deadline: { $gte: now, $lte: new Date(now.getTime() + REMIND_BEFORE) },
  }).limit(200);

  let sent = 0;
  for (const job of jobs) {
    const applied = new Set((await Application.find({ job: job._id }).select('applicant')).map((a) => String(a.applicant)));
    const saved = (await SavedJob.find({ job: job._id }).select('seeker')).map((s) => String(s.seeker));
    const followers = (await Follow.find({ employer: job.employer }).select('seeker')).map((f) => String(f.seeker));
    const titleWords = new Set(words(job.title));
    const matching = (await SeekerProfile.find({ 'job_preferences.desired_roles.0': { $exists: true } }).select('user job_preferences.desired_roles').limit(2000))
      .filter((p) => (p.job_preferences?.desired_roles || []).some((r) => words(r).some((w) => titleWords.has(w))))
      .map((p) => String(p.user));

    const recipients = [...new Set([...saved, ...followers, ...matching])].filter((id) => !applied.has(id));
    const deadline = new Date(job.application_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    sent += await notify(recipients, {
      type: 'deadline',
      title: `Deadline approaching: ${job.title}`,
      message: `Applications for ${job.title} at ${job.company_name} close on ${deadline}. Apply soon if you're interested.`,
      link: `/jobs/${job._id}`,
    });
    sent += await notify(job.employer, {
      type: 'deadline',
      title: `${job.title} closes on ${deadline}`,
      message: `You have ${applied.size} application${applied.size === 1 ? '' : 's'} so far. Extend the deadline if you need more candidates, or start shortlisting.`,
      link: `/employer/jobs/${job._id}/applicants`,
    });
    job.deadline_reminder_sent = true;
    await job.save();
  }
  return sent;
}

/**
 * Reminds candidates (and the employer) about assessments and interviews
 * happening in the next 24 hours. Each step is announced once (dedupe_key).
 */
async function sendStepReminders(now = new Date()) {
  const soon = new Date(now.getTime() + 24 * HOUR);
  const apps = await Application.find({
    status: { $in: ['assessment', 'interview'] },
    status_history: { $elemMatch: { scheduled_at: { $gte: now, $lte: soon } } },
  })
    .populate('job', 'title company_name')
    .populate('applicant', 'name')
    .limit(500);

  let sent = 0;
  for (const a of apps) {
    if (!a.job) continue;
    for (const h of a.status_history) {
      if (!h.scheduled_at || h.scheduled_at < now || h.scheduled_at > soon) continue;
      const label = h.stage_label || (h.status === 'interview' ? 'Interview' : 'Assessment');
      const when = new Date(h.scheduled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const key = `step-reminder:${a._id}:${new Date(h.scheduled_at).toISOString()}`;
      sent += await notify(a.applicant?._id || a.applicant, {
        type: h.status === 'interview' ? 'interview' : 'assessment',
        title: `Tomorrow: ${label} for ${a.job.title}`,
        message: `${a.job.company_name} - ${when}${h.location ? `. ${h.location}` : ''}. Good luck!`,
        link: '/applications',
        dedupe_key: key,
      });
      sent += await notify(a.employer, {
        type: h.status === 'interview' ? 'interview' : 'assessment',
        title: `Tomorrow: ${label} with ${a.applicant?.name || 'a candidate'}`,
        message: `${a.job.title} - ${when}.`,
        link: `/employer/jobs/${a.job._id}/applicants`,
        dedupe_key: key,
      });
    }
  }
  return sent;
}

let timer = null;

/** Runs the reminder check now and then every hour while the server is running. */
function startReminders() {
  if (timer) return;
  const run = () => {
    sendDeadlineReminders().catch((err) => console.error('Deadline reminders failed:', err.message));
    sendStepReminders().catch((err) => console.error('Interview reminders failed:', err.message));
  };
  run();
  timer = setInterval(run, HOUR);
  timer.unref?.();
}

module.exports = { sendDeadlineReminders, sendStepReminders, startReminders };
