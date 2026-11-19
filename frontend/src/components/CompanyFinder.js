import React, { useEffect, useRef, useState } from 'react';
import { profileApi } from '../api/services';
import { API_ORIGIN } from '../api/client';
import { getErrorMessage } from '../utils/helpers';
import { useConfirm } from './ConfirmDialog';

/**
 * First step for a new employer: is your company already on JobNest?
 *  - Search by company name and join it (no need to register it again).
 *    With a work email from the same domain (e.g. @infosys.com) you can post jobs straight away;
 *    otherwise an administrator confirms you first.
 *  - Not listed? Create a new company and get it verified.
 *
 * Props:
 *   initialQuery  pre-fills the search (e.g. the name the employer just typed)
 *   onJoined(res) called after joining, with the API response ({ message, profile })
 *   onCreateNew() called when the employer wants to create a new company instead
 */
export default function CompanyFinder({ initialQuery = '', onJoined, onCreateNew }) {
  const confirm = useConfirm();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(null);
  const timer = useRef(null);

  // Search as you type (short pause so we don't search on every key press)
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setResults(null);
      profileApi
        .searchCompanies(q.trim())
        .then((d) => {
          setResults(d.companies);
          setError('');
        })
        .catch((err) => {
          setResults([]);
          setError(getErrorMessage(err));
        });
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  const join = async (c) => {
    const ok = await confirm({
      title: `Join ${c.company_name}?`,
      message: `You'll post jobs as ${c.company_name}. If your email isn't from the company's own domain, an administrator will confirm that you work there before you can post.`,
      confirmText: 'Join company',
      tone: 'primary',
    });
    if (!ok) return;
    setJoining(c.id);
    setError('');
    try {
      const res = await profileApi.joinCompany(c.id);
      onJoined?.(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoining(null);
    }
  };

  return (
    <section className="jn-card p-4 company-finder fade-up" aria-labelledby="finder-heading">
      <div className="d-flex align-items-start gap-3 mb-3">
        <span className="icon-bubble" aria-hidden="true"><i className="bi bi-search" /></span>
        <div>
          <h2 id="finder-heading" className="h5 fw-bold mb-1">Is your company already on JobNest?</h2>
          <p className="text-muted small mb-0">
            Search for it by name. If a colleague has registered it, join it and post jobs under the same company page.
          </p>
        </div>
      </div>

      <label htmlFor="company-search" className="visually-hidden">Company name</label>
      <div className="finder-search mb-3">
        <i className="bi bi-building" aria-hidden="true" />
        <input
          id="company-search"
          className="form-control form-control-lg"
          placeholder="Type your company name, e.g. Infosys"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>

      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

      <div aria-live="polite">
        {results === null && (
          <div className="small text-muted py-2"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Searching...</div>
        )}
        {results && results.length === 0 && (
          <p className="small text-muted mb-3">
            {q.trim() ? `No company called "${q.trim()}" is registered yet.` : 'Start typing to search for your company.'}
          </p>
        )}
        {results && results.length > 0 && (
          <>
            {!q.trim() && <div className="section-label">Verified companies</div>}
            <ul className="list-unstyled mb-3 finder-list">
              {results.map((c) => (
                <li key={c.id} className="finder-item">
                  {c.logo_url ? (
                    <img src={`${API_ORIGIN}${c.logo_url}`} alt="" className="company-logo sm" />
                  ) : (
                    <span className="icon-bubble sm" aria-hidden="true"><i className="bi bi-building" /></span>
                  )}
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-semibold text-truncate">
                      {c.company_name}
                      {c.verified ? (
                        <span className="badge rounded-pill text-bg-success ms-2"><i className="bi bi-patch-check-fill me-1" aria-hidden="true" />Verified</span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary ms-2">Not verified yet</span>
                      )}
                    </div>
                    <div className="small text-muted text-truncate">
                      {[c.industry, c.location, `${c.members} recruiter${c.members === 1 ? '' : 's'}`].filter(Boolean).join(' \u00b7 ')}
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm btn-primary" disabled={Boolean(joining)} onClick={() => join(c)}>
                    {joining === c.id && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
                    Join
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="finder-create">
        <div>
          <div className="fw-semibold">Can't find your company?</div>
          <div className="small text-muted">Create its company page, then upload your registration document to get verified.</div>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={onCreateNew}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />Create a new company
        </button>
      </div>
    </section>
  );
}
