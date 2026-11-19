import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applicationApi, jobApi, profileApi, assessmentApi } from '../api/services';
import Loader from '../components/Loader';
import FormAlert from '../components/FormAlert';
import { ApplicationStatusBadge, VerificationBadge } from '../components/StatusBadge';
import { DashHero, StatTile } from '../components/DashboardKit';
import { ROLES, formatDate, getErrorCode, getErrorMessage } from '../utils/helpers';

// Stat card with count-up number and coloured accent (see components/DashboardKit.js)
function StatCard(props) {
  return <StatTile {...props} />;
}

function Step({ done, title, text, to, cta }) {
  return (
    <li className="d-flex align-items-start gap-3 py-3 border-bottom">
      <i className={`bi ${done ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'} fs-4`} aria-hidden="true" />
      <div className="flex-grow-1">
        <div className="fw-semibold">
          {title} <span className="visually-hidden">{done ? '(completed)' : '(not completed)'}</span>
        </div>
        <div className="small text-muted">{text}</div>
      </div>
      {!done && <Link to={to} className="btn btn-sm btn-primary">{cta}</Link>}
    </li>
  );
}

function SeekerDashboard({ user }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    Promise.allSettled([
      profileApi.getMine(),
      assessmentApi.latest(),
      applicationApi.mine(),
      jobApi.matched({ limit: 3 }),
    ]).then(([profile, assessment, apps, jobs]) => {
      setState({
        loading: false,
        profile: profile.value?.profile,
        report: assessment.value?.report,
        applications: apps.value?.applications || [],
        jobs: jobs.value?.jobs || [],
        jobTotal: jobs.value?.total ?? 0,
        jobsBlocked: jobs.status === 'rejected' ? getErrorCode(jobs.reason) : null,
        error: [profile, assessment, apps].find((r) => r.status === 'rejected')?.reason,
      });
    });
  }, []);

  if (state.loading) return <Loader text="Loading your dashboard..." />;
  const active = state.applications.filter((a) => !['rejected', 'withdrawn', 'hired'].includes(a.status)).length;
  const setupDone = [Boolean(state.profile), Boolean(state.profile?.resume), Boolean(state.report), state.applications.length > 0].filter(Boolean).length;

  return (
    <>
      <DashHero
        name={user.name.split(' ')[0]}
        subtitle="Here is what is happening with your job search."
        ring={{ percent: (setupDone / 4) * 100, label: 'Setup done' }}
        actions={
          <>
            <Link to="/jobs" className="btn btn-accent"><i className="bi bi-search me-2" aria-hidden="true" />Find jobs</Link>
            <Link to="/applications" className="btn dash-hero-ghost">My applications</Link>
          </>
        }
      />
      {state.error && <FormAlert message={getErrorMessage(state.error)} />}

      <div className="row g-3 mb-4 stagger">
        <div className="col-6 col-lg-3"><StatCard icon="briefcase" label="Matched jobs" value={state.jobTotal} to="/jobs" tone="yellow" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="send-check" label="Applications" value={state.applications.length} to="/applications" tone="blue" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="hourglass-split" label="In progress" value={active} to="/applications" tone="green" /></div>
        <div className="col-6 col-lg-3">
          <StatCard icon="stars" label="Top trait" value={state.report ? state.report.dimensions.find((d) => d.key === state.report.top_traits[0])?.label : '-'} to="/assessment/report" tone="violet" />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="jn-card p-4 h-100">
            <h2 className="h5 fw-bold">Getting started</h2>
            <ul className="list-unstyled mb-0">
              <Step done={Boolean(state.profile)} title="Create your profile" text="Add skills, education, experience and preferences." to={state.profile ? "/profile" : "/onboarding"} cta="Create" />
              <Step done={Boolean(state.profile?.resume)} title="Upload your resume" text="Employers see it when you apply." to="/profile" cta="Upload" />
              <Step done={Boolean(state.report)} title="Take the personality assessment" text="Required before you can view matched jobs." to="/assessment" cta="Start" />
              <Step done={state.applications.length > 0} title="Apply for a matched job" text="Track every application in one place." to="/jobs" cta="Browse" />
            </ul>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="jn-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 fw-bold mb-0">Top matches for you</h2>
              <Link to="/jobs" className="small">View all</Link>
            </div>
            {state.jobsBlocked === 'PROFILE_REQUIRED' && <p className="text-muted mb-0">Create your profile to see matched jobs.</p>}
            {state.jobsBlocked === 'ASSESSMENT_REQUIRED' && <p className="text-muted mb-0">Complete the assessment to unlock matched jobs.</p>}
            {!state.jobsBlocked && state.jobs.length === 0 && <p className="text-muted mb-0">No matching jobs right now. Try adding more skills to your profile.</p>}
            {state.jobs.map((job) => (
              <Link key={job._id} to={`/jobs/${job._id}`} className="d-flex align-items-center gap-3 py-2 border-bottom text-decoration-none text-reset">
                <span className="icon-bubble" aria-hidden="true"><i className="bi bi-briefcase" /></span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{job.title}</div>
                  <div className="small text-muted">{job.company_name} &middot; {job.location}</div>
                </div>
                <span className="badge text-bg-success">{job.match.score}% match</span>
              </Link>
            ))}
          </div>
          <div className="jn-card p-4">
            <h2 className="h5 fw-bold mb-3">Recent applications</h2>
            {state.applications.length === 0 && <p className="text-muted mb-0">You have not applied for any jobs yet.</p>}
            {state.applications.slice(0, 4).map((a) => (
              <div key={a.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                <div className="flex-grow-1">
                  <div className="fw-semibold">{a.job?.title || 'Job no longer available'}</div>
                  <div className="small text-muted">{a.job?.company_name} &middot; Applied {formatDate(a.createdAt)}</div>
                </div>
                <ApplicationStatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function EmployerDashboard({ user }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    Promise.allSettled([profileApi.getMine(), jobApi.mine()]).then(([profile, jobs]) => {
      setState({
        loading: false,
        profile: profile.value?.profile,
        jobs: jobs.value?.jobs || [],
        error: [profile, jobs].find((r) => r.status === 'rejected')?.reason,
      });
    });
  }, []);

  if (state.loading) return <Loader text="Loading your dashboard..." />;
  const verification = state.profile?.verification?.status || 'not_submitted';
  const openJobs = state.jobs.filter((j) => j.status === 'open' && j.moderation_status === 'active').length;
  const totalApplications = state.jobs.reduce((sum, j) => sum + (j.application_count || 0), 0);
  const hiringSteps = [Boolean(state.profile), verification === 'approved', state.jobs.length > 0, totalApplications > 0].filter(Boolean).length;

  return (
    <>
      <DashHero
        name={state.profile?.company_name || user.name}
        subtitle="Here is how your hiring is going."
        ring={{ percent: (hiringSteps / 4) * 100, label: 'Hiring setup' }}
        actions={
          <>
            <Link to="/employer/jobs/new" className={`btn btn-accent ${verification !== 'approved' ? 'disabled' : ''}`} aria-disabled={verification !== 'approved'}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />Post a job
            </Link>
            <Link to="/employer/jobs" className="btn dash-hero-ghost">Manage jobs</Link>
          </>
        }
      >
        <div className="dash-hero-chip">Verification: <VerificationBadge status={verification} /></div>
      </DashHero>
      {state.error && <FormAlert message={getErrorMessage(state.error)} />}
      {!state.profile && (
        <FormAlert type="info" message="Create your company profile to get started.">
          {' '}<Link to="/onboarding">Create company profile</Link>
        </FormAlert>
      )}
      {state.profile && verification !== 'approved' && (
        <FormAlert type="warning" message="You can post jobs after an administrator verifies your company.">
          {' '}<Link to="/company#verification">{verification === 'pending' ? 'View verification status' : 'Submit verification'}</Link>
        </FormAlert>
      )}

      <div className="row g-3 mb-4 stagger">
        <div className="col-6 col-lg-3"><StatCard icon="briefcase" label="Open jobs" value={openJobs} to="/employer/jobs" tone="yellow" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="collection" label="Total jobs" value={state.jobs.length} to="/employer/jobs" tone="blue" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="people" label="Applications received" value={totalApplications} to="/employer/jobs" tone="green" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="building" label="Company profile" value={state.profile ? 'Ready' : 'Missing'} to="/company" tone="violet" /></div>
      </div>

      <div className="jn-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 fw-bold mb-0">Your latest jobs</h2>
          <Link to="/employer/jobs" className="small">Manage jobs</Link>
        </div>
        {state.jobs.length === 0 && <p className="text-muted mb-0">You have not posted any jobs yet.</p>}
        {state.jobs.slice(0, 5).map((job) => (
          <div key={job._id} className="d-flex flex-wrap align-items-center gap-3 py-2 border-bottom">
            <div className="flex-grow-1">
              <div className="fw-semibold">{job.title}</div>
              <div className="small text-muted">{job.location} &middot; Posted {formatDate(job.createdAt)}</div>
            </div>
            <span className={`badge text-bg-${job.status === 'open' ? 'success' : 'secondary'}`}>{job.status}</span>
            <Link to={`/employer/jobs/${job._id}/applicants`} className="btn btn-sm btn-outline-primary">
              {job.application_count} applicant{job.application_count === 1 ? '' : 's'}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === ROLES.ADMIN) return <Navigate to="/admin" replace />;
  return (
    <div className="container py-4 dash">
      {user.role === ROLES.EMPLOYER ? <EmployerDashboard user={user} /> : <SeekerDashboard user={user} />}
    </div>
  );
}
