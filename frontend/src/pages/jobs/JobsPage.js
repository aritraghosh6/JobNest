import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import { EMPLOYMENT_TYPES, formatDate, getErrorCode, getErrorMessage, typeLabel } from '../../utils/helpers';

const EMPTY_FILTERS = { q: '', location: '', employment_type: '', min_salary: '', sort: 'relevance' };

function JobCard({ job }) {
  const { match } = job;
  return (
    <article className="jn-card jn-card-hover p-4 mb-3">
      <div className="d-flex flex-wrap gap-3 align-items-start">
        <span className="icon-bubble" aria-hidden="true"><i className="bi bi-briefcase" /></span>
        <div className="flex-grow-1">
          <h2 className="h5 fw-bold mb-1">
            <Link to={`/jobs/${job._id}`} className="text-reset text-decoration-none">{job.title}</Link>
          </h2>
          <div className="text-muted small mb-2">
            {job.company_name} · <i className="bi bi-geo-alt" aria-hidden="true" /> {job.location}
            {job.is_remote && ' · Remote-friendly'} · {typeLabel(job.employment_type)} · {job.salary_range}
          </div>
          <div className="mb-2">
            {match.matched_skills.map((s) => <span className="skill-chip" key={s}><i className="bi bi-check2" aria-hidden="true" />{s}</span>)}
            {match.missing_skills.map((s) => <span className="skill-chip missing" key={s} title="Skill you have not listed">{s}</span>)}
          </div>
          <ul className="small text-muted mb-0 ps-3">
            {match.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <div className="text-end">
          <div className={`badge fs-6 mb-2 text-bg-${match.score >= 75 ? 'success' : match.score >= 55 ? 'warning' : 'secondary'}`}>
            {match.score}% match
          </div>
          <div className="small text-muted mb-2">Posted {formatDate(job.createdAt)}</div>
          {job.has_applied ? (
            <span className="badge text-bg-light border"><i className="bi bi-check2-circle me-1" aria-hidden="true" />Applied</span>
          ) : (
            <Link to={`/jobs/${job._id}`} className="btn btn-sm btn-primary">View and apply</Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function JobsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: 10 };
    Object.entries(applied).forEach(([k, v]) => {
      if (v !== '') params[k] = v;
    });
    jobApi
      .matched(params)
      .then(setResult)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (filters.min_salary !== '' && (Number.isNaN(Number(filters.min_salary)) || Number(filters.min_salary) < 0)) {
      setError({ message: 'Minimum salary must be a positive number.' });
      return;
    }
    setPage(1);
    setApplied(filters);
  };

  const code = getErrorCode(error);

  return (
    <div className="container py-4">
      <PageHeader icon="briefcase" title="Jobs matched to you" subtitle="Only jobs that match your skills and preferences are shown, sorted by relevance." />

      <form className="jn-card p-3 mb-4" onSubmit={onSubmit} role="search" aria-label="Search and filter jobs">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label htmlFor="q" className="form-label small">Keyword</label>
            <input id="q" className="form-control" placeholder="Title, skill or company" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <div className="col-md-2">
            <label htmlFor="loc" className="form-label small">Location</label>
            <input id="loc" className="form-control" placeholder="e.g. Pune or Remote" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
          </div>
          <div className="col-md-2">
            <label htmlFor="type" className="form-label small">Job type</label>
            <select id="type" className="form-select" value={filters.employment_type} onChange={(e) => setFilters({ ...filters, employment_type: e.target.value })}>
              <option value="">Any</option>
              {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label htmlFor="min_salary" className="form-label small">Min. salary (₹/yr)</label>
            <input id="min_salary" type="number" min="0" className="form-control" value={filters.min_salary} onChange={(e) => setFilters({ ...filters, min_salary: e.target.value })} />
          </div>
          <div className="col-md-2">
            <label htmlFor="sort" className="form-label small">Sort by</label>
            <select id="sort" className="form-select" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="salary">Highest salary</option>
            </select>
          </div>
          <div className="col-12 d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); }}>Clear</button>
            <button type="submit" className="btn btn-primary"><i className="bi bi-search me-1" aria-hidden="true" />Search</button>
          </div>
        </div>
      </form>

      {loading && <Loader text="Finding jobs that match you…" />}

      {!loading && code === 'PROFILE_REQUIRED' && (
        <EmptyState icon="person-plus" title="Create your profile first" text={getErrorMessage(error)} action={<Link to="/profile" className="btn btn-primary">Create profile</Link>} />
      )}
      {!loading && code === 'ASSESSMENT_REQUIRED' && (
        <EmptyState icon="clipboard-check" title="Complete the assessment" text={getErrorMessage(error)} action={<Link to="/assessment" className="btn btn-primary">Take the assessment</Link>} />
      )}
      {!loading && error && !code && <FormAlert message={getErrorMessage(error)} />}

      {!loading && !error && result && (
        <>
          <p className="text-muted small" aria-live="polite">{result.total} matching job{result.total === 1 ? '' : 's'} found</p>
          {result.jobs.length === 0 ? (
            <EmptyState
              icon="search"
              title="No matching jobs right now"
              text="Try clearing filters, or add more skills and preferred locations to your profile to widen your matches."
              action={<Link to="/profile" className="btn btn-outline-primary">Update profile</Link>}
            />
          ) : (
            <div className="stagger">{result.jobs.map((job) => <JobCard key={job._id} job={job} />)}</div>
          )}
          {result.pages > 1 && (
            <nav aria-label="Job results pages" className="d-flex justify-content-center mt-3">
              <ul className="pagination">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" onClick={() => setPage(page - 1)}>Previous</button>
                </li>
                <li className="page-item disabled"><span className="page-link">Page {result.page} of {result.pages}</span></li>
                <li className={`page-item ${page >= result.pages ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" onClick={() => setPage(page + 1)}>Next</button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
