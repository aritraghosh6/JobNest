import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { jobApi, profileApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDate, getErrorMessage, typeLabel, deadlineInfo } from '../../utils/helpers';

export default function EmployerJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const [success, setSuccess] = useState(location.state?.message || '');

  const load = () =>
    Promise.all([jobApi.mine(), profileApi.getMine()])
      .then(([j, p]) => {
        setJobs(j.jobs);
        setVerified(p.profile?.verification?.status === 'approved');
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (job, fn) => {
    setBusyId(job._id);
    setError('');
    try {
      const res = await fn();
      setSuccess(res.message);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container py-4">
      <PageHeader
        icon="briefcase"
        title="My job postings"
        subtitle="Create, edit, close and review applicants for your jobs."
        actions={verified ? (
          <Link to="/employer/jobs/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" aria-hidden="true" />Post a job</Link>
        ) : (
          <Link to="/company#verification" className="btn btn-outline-primary">Verify company to post jobs</Link>
        )}
      />
      <FormAlert message={error} onClose={() => setError('')} />
      <FormAlert type="success" message={success} onClose={() => setSuccess('')} />
      {loading && <Loader text="Loading your jobs..." />}
      {!loading && jobs.length === 0 && (
        <EmptyState icon="briefcase" title="No jobs posted yet" text={verified ? 'Post your first job to start receiving applications.' : 'Your company must be verified before you can post jobs.'} action={verified && <Link to="/employer/jobs/new" className="btn btn-primary">Post a job</Link>} />
      )}
      {!loading && jobs.length > 0 && (
        <div className="jn-card p-0 overflow-hidden fade-up">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Type</th>
                  <th scope="col">Posted</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applicants</th>
                  <th scope="col" className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const removed = job.moderation_status === 'removed';
                  const busy = busyId === job._id;
                  return (
                    <tr key={job._id}>
                      <td>
                        <Link to={`/jobs/${job._id}`} className="fw-semibold">{job.title}</Link>
                        <div className="small text-muted">{job.location} &middot; {job.salary_range}</div>
                        {removed && <div className="small text-danger">Removed by admin: {job.moderation_note}</div>}
                      </td>
                      <td>{typeLabel(job.employment_type)}</td>
                      <td>{formatDate(job.createdAt)}</td>
                      <td>
                        <span className={`badge rounded-pill text-bg-${removed ? 'danger' : job.status === 'open' ? 'success' : job.closed_reason === 'filled' ? 'primary' : job.closed_reason === 'limit_reached' ? 'warning' : 'secondary'}`}>
                          {removed ? 'Removed' : job.status === 'open' ? 'Open' : job.closed_reason === 'filled' ? 'Filled' : job.closed_reason === 'limit_reached' ? 'Limit reached' : 'Closed'}
                        </span>
                        {job.application_deadline && (() => {
                          const d = deadlineInfo(job.application_deadline);
                          return <div className={`small mt-1 ${d.past ? 'text-danger' : d.soon ? 'text-warning-emphasis fw-semibold' : 'text-muted'}`}>{d.text}{d.past && job.status === 'open' ? ' (hidden from job seekers)' : ''}</div>;
                        })()}
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <Link to={`/employer/jobs/${job._id}/applicants`} className="fw-semibold">
                          {job.application_count}{job.max_applicants ? ` / ${job.max_applicants}` : ''}
                        </Link>
                        <span className="small text-muted"> applicant{job.application_count === 1 ? '' : 's'}</span>
                        {job.max_applicants ? (
                          <div className="progress mt-1" style={{ height: 5 }} role="progressbar" aria-label={`${job.application_count} of ${job.max_applicants} applications`} aria-valuenow={job.application_count} aria-valuemin={0} aria-valuemax={job.max_applicants}>
                            <div className={`progress-bar ${job.application_count >= job.max_applicants ? 'bg-danger' : job.application_count >= job.max_applicants * 0.8 ? 'bg-warning' : ''}`} style={{ width: `${Math.min(100, (job.application_count / job.max_applicants) * 100)}%` }} />
                          </div>
                        ) : null}
                        {(job.status_counts?.interview || job.status_counts?.hired) ? (
                          <div className="small text-muted mt-1">
                            {job.status_counts?.interview ? `${job.status_counts.interview} interviewing` : ''}
                            {job.status_counts?.interview && job.status_counts?.hired ? ' \u00b7 ' : ''}
                            {job.status_counts?.hired ? `${job.status_counts.hired} selected` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap gap-1 justify-content-end">
                          <Link to={`/employer/jobs/${job._id}/applicants`} className="btn btn-sm btn-outline-primary">Applicants</Link>
                          {!removed && <Link to={`/employer/jobs/${job._id}/edit`} className="btn btn-sm btn-outline-secondary">Edit</Link>}
                          {!removed && job.closed_reason !== 'filled' && (
                            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => act(job, () => jobApi.setStatus(job._id, job.status === 'open' ? 'closed' : 'open'))}>
                              {job.status === 'open' ? 'Close' : 'Reopen'}
                            </button>
                          )}
                          {job.application_count === 0 && (
                            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => setToDelete(job)} aria-label={`Delete ${job.title}`}>
                              <i className="bi bi-trash" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        tone="danger"
        title="Delete this job?"
        message={toDelete ? `"${toDelete.title}" will be deleted permanently. This can't be undone.` : ''}
        confirmText="Delete job"
        busy={Boolean(toDelete) && busyId === toDelete._id}
        onConfirm={async () => {
          await act(toDelete, () => jobApi.remove(toDelete._id));
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
