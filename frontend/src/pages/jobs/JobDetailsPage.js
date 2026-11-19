import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { followApi, jobApi, profileApi } from '../../api/services';
import { API_ORIGIN } from '../../api/client';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import ScoreRing from '../../components/ScoreRing';
import { ApplicationStatusBadge, VerificationBadge } from '../../components/StatusBadge';
import { ROLES, cultureLabel, formatDate, getErrorMessage, typeLabel } from '../../utils/helpers';

function ApplyPanel({ job, onApplied }) {
  const [hasResume, setHasResume] = useState(null);
  const [cover, setCover] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    profileApi.getMine().then((d) => setHasResume(Boolean(d.profile?.resume))).catch(() => setHasResume(false));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (cover.length > 2000) return setError('Cover letter must be 2000 characters or fewer.');
    setSubmitting(true);
    setError('');
    try {
      const res = await jobApi.apply(job._id, { cover_letter_text: cover.trim() || undefined });
      onApplied(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="jn-card p-4" onSubmit={onSubmit} noValidate>
      <h2 className="h5 fw-bold">Apply for this job</h2>
      <FormAlert message={error} onClose={() => setError('')} />
      {hasResume === false && (
        <FormAlert type="warning" message="You have not uploaded a resume. Employers will only see your profile.">
          {' '}<Link to="/profile">Upload a resume</Link>
        </FormAlert>
      )}
      <label htmlFor="cover" className="form-label">Short cover letter (optional)</label>
      <textarea id="cover" className="form-control mb-1" rows={5} maxLength={2000} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Why are you a good fit for this role?" />
      <div className="form-text mb-3">{cover.length}/2000 characters</div>
      <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
        {submitting && <Loader small />}
        {submitting ? 'Submitting...' : 'Submit application'}
      </button>
    </form>
  );
}

/** Save job and Follow company buttons for job seekers. */
function SeekerActions({ job, setJob }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // While the pointer is on "Following", the button shows what a click will do: Unfollow
  const [hoverFollow, setHoverFollow] = useState(false);

  const toggle = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      let res;
      if (kind === 'save') res = job.is_saved ? await jobApi.unsave(job._id) : await jobApi.save(job._id);
      else res = job.is_following ? await followApi.unfollow(job.employer) : await followApi.follow(job.employer);
      setJob((j) => ({ ...j, ...(kind === 'save' ? { is_saved: res.saved } : { is_following: res.following }) }));
      setMessage(res.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="jn-card p-4 mb-4 fade-up">
      <div className="d-grid gap-2">
        <button type="button" className={`btn ${job.is_saved ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={Boolean(job.is_saved)} disabled={busy === 'save'} onClick={() => toggle('save')}>
          <i className={`bi bi-bookmark${job.is_saved ? '-check-fill' : ''} me-2`} aria-hidden="true" />
          {job.is_saved ? 'Saved' : 'Save job'}
        </button>
        <button
          type="button"
          className={`btn ${job.is_following ? (hoverFollow ? 'btn-outline-danger' : 'btn-secondary') : 'btn-outline-secondary'}`}
          aria-pressed={Boolean(job.is_following)}
          aria-label={job.is_following ? `Following ${job.company_name}. Click to unfollow.` : `Follow ${job.company_name}`}
          title={job.is_following ? 'Click to unfollow' : 'Get notified when this company posts a new job'}
          disabled={busy === 'follow'}
          onClick={() => toggle('follow')}
          onMouseEnter={() => setHoverFollow(true)}
          onMouseLeave={() => setHoverFollow(false)}
          onFocus={() => setHoverFollow(true)}
          onBlur={() => setHoverFollow(false)}
        >
          {job.is_following ? (
            hoverFollow ? (
              <><i className="bi bi-bell-slash me-2" aria-hidden="true" />Unfollow {job.company_name}</>
            ) : (
              <><i className="bi bi-check2 me-2" aria-hidden="true" />Following {job.company_name}</>
            )
          ) : (
            <><i className="bi bi-bell me-2" aria-hidden="true" />Follow {job.company_name}</>
          )}
        </button>
      </div>
      <p className="small text-muted mb-0 mt-2" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : (
          message ||
          (job.is_following
            ? `You follow ${job.company_name}, so you're notified when it posts a new job.`
            : 'Saved jobs get a reminder before the deadline. Following a company tells you when it posts new jobs.')
        )}
      </p>
    </div>
  );
}

export default function JobDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const load = () =>
    jobApi
      .get(id)
      .then((d) => {
        setJob(d.job);
        return profileApi.getCompany(d.job.employer).then((c) => setCompany(c.profile)).catch(() => {});
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Loader text="Loading job..." />;
  if (!job) return <div className="container py-4"><FormAlert message={error || 'Job not found.'} /><Link to="/jobs">Back to jobs</Link></div>;

  const isSeeker = user.role === ROLES.JOB_SEEKER;
  const isOwner = String(job.employer) === String(user.id);
  const closed = job.status !== 'open' || job.moderation_status !== 'active';

  return (
    <div className="container py-4">
      <Link to={isSeeker ? '/jobs' : isOwner ? '/employer/jobs' : '/admin'} className="small d-inline-block mb-3">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
      </Link>

      {confirmation && (
        <FormAlert type="success" message={confirmation.message + '.'}>
          {' '}
          {confirmation.email_status === 'sent' && 'A confirmation email has been sent to you. '}
          {confirmation.email_status === 'logged' && 'Email delivery is not configured on this server, so the confirmation email was recorded in the server log. '}
          {confirmation.email_status === 'failed' && 'We could not send the confirmation email, but your application was saved. '}
          <Link to="/applications">Track it in My Applications</Link>
        </FormAlert>
      )}
      {job.moderation_status === 'removed' && <FormAlert type="warning" message={`This job was removed by an administrator. ${job.moderation_note || ''}`} />}
      {job.moderation_status !== 'removed' && isSeeker && job.closed_message && !job.my_application && (
        <FormAlert type={job.closed_reason === 'filled' ? 'info' : 'warning'} message={job.closed_message} />
      )}
      {job.moderation_status !== 'removed' && !isSeeker && closed && (
        <FormAlert type="info" message={job.closed_reason === 'filled' ? 'This position has been filled.' : job.closed_reason === 'limit_reached' ? 'This job reached its applicant limit and is closed to new applicants.' : 'This job is closed and no longer accepts applications.'} />
      )}

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="jn-card p-4 mb-4 fade-up">
            <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
              {company?.logo_url ? (
                <img src={`${API_ORIGIN}${company.logo_url}`} alt={`${job.company_name} logo`} className="company-logo" />
              ) : (
                <span className="icon-bubble" style={{ width: 56, height: 56 }} aria-hidden="true"><i className="bi bi-building" /></span>
              )}
              <div>
                <h1 className="h3 fw-bold mb-1">{job.title}</h1>
                <div className="text-muted">
                  {job.company_name} {company && <VerificationBadge status={company.verification?.status} />}
                </div>
              </div>
            </div>
            <div className="row g-3 small mb-3">
              <div className="col-6 col-md-3"><div className="text-muted">Location</div><div className="fw-semibold">{job.location}{job.is_remote ? ' (remote-friendly)' : ''}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted">Type</div><div className="fw-semibold">{typeLabel(job.employment_type)}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted">Salary (per year)</div><div className="fw-semibold">{job.salary_range}</div></div>
              <div className="col-6 col-md-3"><div className="text-muted">Experience</div><div className="fw-semibold">{job.experience_min ? `${job.experience_min}+ years` : 'Freshers welcome'}</div></div>
            </div>
            <div className="d-flex flex-wrap gap-3 small mb-3 text-muted">
              {job.application_deadline && (
                new Date(job.application_deadline) < new Date() ? (
                  <span className="text-danger"><i className="bi bi-calendar-x me-1" aria-hidden="true" />Applications closed on <strong>{formatDate(job.application_deadline)}</strong></span>
                ) : (
                  <span><i className="bi bi-calendar-event me-1" aria-hidden="true" />Apply by <strong className="text-body">{formatDate(job.application_deadline)}</strong></span>
                )
              )}
              <span>
                <i className="bi bi-people me-1" aria-hidden="true" />
                <strong className="text-body">{job.application_count ?? 0}</strong>
                {job.max_applicants ? ` of ${job.max_applicants}` : ''} applicant{job.application_count === 1 ? '' : 's'}
              </span>
              <span><i className="bi bi-clock me-1" aria-hidden="true" />Posted {formatDate(job.createdAt)}</span>
            </div>
            <h2 className="h6 fw-bold">Required skills</h2>
            <div className="mb-3">{job.skills_required.map((s) => <span key={s} className="skill-chip neutral">{s}</span>)}</div>
            <h2 className="h6 fw-bold">Job description</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{job.description}</p>
            {job.qualifications && (
              <>
                <h2 className="h6 fw-bold">Qualifications</h2>
                <p style={{ whiteSpace: 'pre-line' }}>{job.qualifications}</p>
              </>
            )}
            {job.culture_tags?.length > 0 && (
              <>
                <h2 className="h6 fw-bold">Team culture</h2>
                <div>{job.culture_tags.map((t) => <span key={t} className="skill-chip">{cultureLabel(t)}</span>)}</div>
              </>
            )}
          </div>

          {company && (
            <div className="jn-card p-4 fade-up">
              <h2 className="h5 fw-bold">About {company.company_name}</h2>
              <p className="small text-muted mb-2">{company.industry} &middot; {company.location}{company.company_size ? ` \u00b7 ${company.company_size} employees` : ''}</p>
              <p style={{ whiteSpace: 'pre-line' }}>{company.company_description}</p>
              {company.culture_description && (
                <>
                  <h3 className="h6 fw-bold">Culture</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>{company.culture_description}</p>
                </>
              )}
              {company.values?.length > 0 && <div>{company.values.map((v) => <span key={v} className="skill-chip neutral">{v}</span>)}</div>}
              {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="small">Visit website <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}
            </div>
          )}
        </div>

        <div className="col-lg-4">
          {isSeeker && job.match && (
            <div className="jn-card p-4 mb-4 text-center fade-up">
              <h2 className="h6 fw-bold mb-3">Your match</h2>
              <ScoreRing score={job.match.score} label="Match score" />
              <ul className="list-unstyled small text-start mt-3 mb-2">
                <li className="d-flex justify-content-between"><span>Skills (60%)</span><strong>{job.match.breakdown.skills}/100</strong></li>
                <li className="d-flex justify-content-between"><span>Preferences (20%)</span><strong>{job.match.breakdown.preferences}/100</strong></li>
                <li className="d-flex justify-content-between"><span>Culture fit (20%)</span><strong>{job.match.breakdown.culture ?? 'Neutral (50)'}{job.match.breakdown.culture !== null ? '/100' : ''}</strong></li>
              </ul>
              <ul className="small text-muted text-start ps-3 mb-0">
                {job.match.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {!job.match.is_match && <div className="alert alert-warning small mt-3 mb-0">This job does not match your skills and preferences, so you cannot apply.</div>}
            </div>
          )}
          {isSeeker && !job.match && (
            <FormAlert type="info" message="Complete your profile and the assessment to see your match and apply.">
              {' '}<Link to="/dashboard">Go to dashboard</Link>
            </FormAlert>
          )}
          {isSeeker && <SeekerActions job={job} setJob={setJob} />}
          {isSeeker && job.my_application && (
            <div className="jn-card p-4 mb-4">
              <h2 className="h6 fw-bold">Your application</h2>
              <ApplicationStatusBadge status={job.my_application.status} />
              <div className="small text-muted mt-2">Applied on {formatDate(job.my_application.createdAt)}</div>
            </div>
          )}
          {isSeeker && job.can_apply && job.match?.is_match && !confirmation && (
            <ApplyPanel job={job} onApplied={(res) => { setConfirmation(res); setLoading(true); load(); }} />
          )}
          {isOwner && (
            <div className="jn-card p-4 d-grid gap-2">
              <Link to={`/employer/jobs/${job._id}/applicants`} className="btn btn-primary">View applicants</Link>
              {job.moderation_status === 'active' && <Link to={`/employer/jobs/${job._id}/edit`} className="btn btn-outline-primary">Edit job</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
