/**
 * One place that lists every Mongoose model (= every MongoDB collection) in JobNest.
 * Full field reference: docs/DATABASE.md
 *
 *   Model            Collection         Purpose
 *   User             users              login accounts (job_seeker, employer, admin)
 *   SeekerProfile    jobseekerprofiles  job seeker profile + resume/cover-letter metadata   (US1)
 *   Assessment       assessmentresults  personality assessment answers and scores          (US2)
 *   Job              jobs               job postings                                        (US3, US6)
 *   Application      applications       job applications with status history                (US4)
 *   EmployerProfile  employerprofiles   company profile, culture, logo, verification        (US5)
 *   Connection       connections        networking requests / connections                   (US7)
 *   Message          messages           private messages between connections                (US7)
 *   ResumeAnalysis   atsanalyses        ATS checker results (resume files are not stored)   (ATS)
 *   EmailOtp         emailotps          sign-up verification codes (auto-deleted after 10 minutes)
 *   PasswordReset    passwordresets     password-reset codes (auto-deleted after 10 minutes)
 *   Notification     notifications      in-app notifications (bell icon)
 *   Follow           follows            job seekers following companies
 *   SavedJob         savedjobs          jobs a seeker saved
 */
const User = require('./User');
const SeekerProfile = require('./SeekerProfile');
const EmployerProfile = require('./EmployerProfile');
const Job = require('./Job');
const Application = require('./Application');
const Assessment = require('./Assessment');
const Connection = require('./Connection');
const Message = require('./Message');
const ResumeAnalysis = require('./ResumeAnalysis');
const EmailOtp = require('./EmailOtp');
const PasswordReset = require('./PasswordReset');
const Notification = require('./Notification');
const Follow = require('./Follow');
const SavedJob = require('./SavedJob');

module.exports = {
  User,
  SeekerProfile,
  EmployerProfile,
  Job,
  Application,
  Assessment,
  Connection,
  Message,
  ResumeAnalysis,
  EmailOtp,
  PasswordReset,
  Notification,
  Follow,
  SavedJob,
};
