import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { followApi, jobApi } from "../../api/services";
import { API_ORIGIN } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Loader from "../../components/Loader";
import FormAlert from "../../components/FormAlert";
import EmptyState from "../../components/EmptyState";
import { deadlineInfo, getErrorMessage, typeLabel } from "../../utils/helpers";

export default function SavedPage() {
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [canMatch, setCanMatch] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([jobApi.saved(), followApi.list()])
      .then(([j, f]) => {
        setJobs(j.jobs);
        setCompanies(f.companies);
        setCanMatch(f.can_match !== false);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const unsave = async (job) => {
    try {
      const res = await jobApi.unsave(job._id);
      setJobs((list) => list.filter((j) => j._id !== job._id));
      setSuccess(res.message);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const unfollow = async (c) => {
    try {
      const res = await followApi.unfollow(c.employer_id);
      setCompanies((list) => list.filter((x) => x.employer_id !== c.employer_id));
      setSuccess(res.message);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <Loader text="Loading your saved items..." />;

  return (
    <div className="container py-4">
      <PageHeader icon="bookmark-heart" title="Saved" subtitle="Jobs you've saved and companies you follow. We'll remind you before deadlines and tell you about new jobs." />
      <FormAlert message={error} onClose={() => setError("")} />
      <FormAlert type="success" message={success} onClose={() => setSuccess("")} />

      <div className="row g-4">
        <div className="col-lg-8">
          <h2 className="section-label">Saved jobs ({jobs.length})</h2>
          {jobs.length === 0 && (
            <EmptyState icon="bookmark" title="No saved jobs" text="Open a job and choose 'Save job' to keep it here." action={<Link to="/jobs" className="btn btn-primary">Browse jobs</Link>} />
          )}
          <div className="stagger">
            {jobs.map((job) => {
              const deadline = deadlineInfo(job.application_deadline);
              const closed = job.status !== "open" || deadline.past;
              return (
                <article key={job._id} className="jn-card jn-card-hover p-4 mb-3">
                  <div className="d-flex flex-wrap gap-3 align-items-start">
                    <span className="icon-bubble" aria-hidden="true"><i className="bi bi-briefcase" /></span>
                    <div className="flex-grow-1 min-w-0">
                      <h3 className="h5 fw-bold mb-1"><Link to={`/jobs/${job._id}`} className="text-reset">{job.title}</Link></h3>
                      <div className="small text-muted">{job.company_name} &middot; {job.location} &middot; {typeLabel(job.employment_type)}</div>
                      <div className="small mt-1">
                        {closed ? (
                          <span className="text-muted">
                            <i className="bi bi-lock me-1" aria-hidden="true" />
                            {deadline.past ? `${deadline.text}. No longer accepting applications.` : "No longer accepting applications"}
                          </span>
                        ) : job.application_deadline ? (
                          <span className={deadline.soon ? "text-danger fw-semibold" : "text-muted"}>
                            <i className="bi bi-alarm me-1" aria-hidden="true" />
                            {deadline.text}
                            {deadline.soon && deadline.daysLeft > 1 ? ` \u00b7 ${deadline.daysLeft} days left` : ""}
                          </span>
                        ) : (
                          <span className="text-muted">No deadline</span>
                        )}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Link to={`/jobs/${job._id}`} className="btn btn-sm btn-primary">View</Link>
                      <button type="button" className="btn btn-sm btn-light" onClick={() => unsave(job)} aria-label={`Remove ${job.title} from saved jobs`}>
                        <i className="bi bi-bookmark-x" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="col-lg-4">
          <h2 className="section-label">Companies you follow ({companies.length})</h2>
          {companies.length === 0 && <p className="text-muted small">Open any job and choose 'Follow' to hear when that company posts new jobs.</p>}
          <div className="stagger">
            {companies.map((c) => (
              <div key={c.employer_id} className="jn-card p-3 mb-3 follow-card">
                <div className="d-flex align-items-center gap-3">
                  {c.logo_url ? (
                    <img src={`${API_ORIGIN}${c.logo_url}`} alt="" className="company-logo sm" />
                  ) : (
                    <span className="icon-bubble sm" aria-hidden="true"><i className="bi bi-building" /></span>
                  )}
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold text-truncate">{c.company_name}</div>
                    <div className="small text-muted text-truncate">{[c.industry, c.location].filter(Boolean).join(" \u00b7 ")}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => unfollow(c)}>Unfollow</button>
                </div>

                {/* Open jobs at this company that match you by 50% or more */}
                <div className="follow-suggest mt-3">
                  <div className="follow-suggest-head">
                    <i className="bi bi-stars me-1" aria-hidden="true" />Suggested for you
                  </div>
                  {!canMatch ? (
                    <p className="small text-muted mb-0">Complete your profile and assessment to see jobs here that match you.</p>
                  ) : c.suggested_jobs?.length ? (
                    <ul className="list-unstyled mb-0">
                      {c.suggested_jobs.map((j) => (
                        <li key={j.id}>
                          <Link to={`/jobs/${j.id}`} className="follow-job">
                            <span className="min-w-0">
                              <span className="d-block fw-semibold text-truncate">{j.title}</span>
                              <span className="d-block small text-muted text-truncate">
                                {[j.location, typeLabel(j.employment_type)].filter(Boolean).join(" \u00b7 ")}
                                {j.application_deadline ? ` \u00b7 ${deadlineInfo(j.application_deadline).text}` : ""}
                                {j.applied ? " \u00b7 Applied" : ""}
                              </span>
                            </span>
                            <span className={`match-pill ${j.match_score >= 75 ? "high" : "mid"}`}>{j.match_score}%</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small text-muted mb-0">No open jobs here match you by 50% or more right now. We'll tell you when one is posted.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
