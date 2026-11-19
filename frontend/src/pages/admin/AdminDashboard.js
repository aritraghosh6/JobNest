import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/services';
import { useConfirm } from '../../components/ConfirmDialog';
import { DashHero, StatTile } from '../../components/DashboardKit';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import { VerificationBadge } from '../../components/StatusBadge';
import { ROLE_LABELS, formatDate, getErrorMessage, typeLabel } from '../../utils/helpers';

// Personal mailbox providers: anyone can create these, so the company document matters more
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com", "outlook.com", "outlook.in",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "zoho.com", "zohomail.in", "rediffmail.com", "gmx.com", "yandex.com", "mail.com",
];

/** Tells the admin how much the employer's email address says about the company. */
function EmailTrustBadge({ email, website }) {
  const domain = String(email || "").split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (PERSONAL_EMAIL_DOMAINS.includes(domain)) {
    return (
      <span className="badge rounded-pill text-bg-warning ms-1" title="Anyone can create this kind of address. Check the uploaded document carefully.">
        <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />Personal email
      </span>
    );
  }
  let host = "";
  try {
    host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }
  const matches = host && (host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`));
  return matches ? (
    <span className="badge rounded-pill text-bg-success ms-1" title="The email domain matches the company website.">
      <i className="bi bi-patch-check me-1" aria-hidden="true" />Email matches website
    </span>
  ) : (
    <span className="badge rounded-pill text-bg-secondary ms-1" title="Company domain, but it does not match the website given.">
      Company email
    </span>
  );
}


function Overview({ stats }) {
  if (!stats) return <Loader />;
  const cards = [
    { icon: 'person-workspace', label: 'Job seekers', value: stats.job_seekers, tone: 'blue' },
    { icon: 'building', label: 'Employers', value: stats.employers, tone: 'violet' },
    { icon: 'hourglass-split', label: 'Pending verifications', value: stats.pending_verifications, tone: 'rose', hint: stats.pending_verifications ? 'Waiting for your review' : 'All caught up' },
    { icon: 'briefcase', label: 'Open jobs', value: stats.open_jobs, tone: 'yellow' },
    { icon: 'collection', label: 'All jobs', value: stats.total_jobs, tone: 'green' },
    { icon: 'send-check', label: 'Applications', value: stats.applications, tone: 'blue' },
  ];
  return (
    <div className="row g-3 stagger">
      {cards.map((c) => (
        <div className="col-6 col-lg-4" key={c.label}>
          <StatTile icon={c.icon} label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
        </div>
      ))}
    </div>
  );
}

function Verifications({ setMessage }) {
  const [status, setStatus] = useState('pending');
  const [employers, setEmployers] = useState(null);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () => adminApi.employers({ status: status || undefined }).then((d) => setEmployers(d.employers)).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) })),
    [status, setMessage]
  );
  useEffect(() => {
    setEmployers(null);
    load();
  }, [load]);

  const review = async (emp, decision) => {
    const note = (notes[emp._id] || '').trim();
    if (decision === 'rejected' && !note) {
      setMessage({ type: 'warning', text: 'Please enter a reason before rejecting, so the employer knows what to fix.' });
      return;
    }
    setBusyId(emp._id);
    try {
      const res = await adminApi.reviewEmployer(emp._id, decision, note || undefined);
      setMessage({ type: 'success', text: `${emp.company_name}: ${res.message}` });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <select className="form-select w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by verification status">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="not_submitted">Not submitted</option>
          <option value="">All</option>
        </select>
      </div>
      {!employers && <Loader />}
      {employers && employers.length === 0 && <EmptyState icon="shield-check" title="Nothing to review" text="No employers with this status." />}
      {employers?.map((emp) => (
        <div key={emp._id} className="jn-card p-4 mb-3 fade-up">
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <h2 className="h5 fw-bold mb-0">{emp.company_name} <VerificationBadge status={emp.verification.status} /></h2>
              <div className="small text-muted">{emp.industry} &middot; {emp.location} &middot; Contact: {emp.user?.name} ({emp.user?.email}) <EmailTrustBadge email={emp.user?.email} website={emp.website} /></div>
              {emp.website && <a href={emp.website} target="_blank" rel="noreferrer" className="small">{emp.website}</a>}
            </div>
            {emp.joined_company && (
              <div className="alert alert-info small w-100 mb-0">
                <i className="bi bi-people me-1" aria-hidden="true" />
                <strong>Join request:</strong> {emp.user?.name} wants to post jobs for <strong>{emp.joined_company_name || emp.company_name}</strong>, which is already registered.
                No document is needed. Approve only if you're satisfied they work there (check their email address above).
              </div>
            )}
            <div className="small text-end">
              {emp.verification.registration_number && <div>Reg. no: <strong>{emp.verification.registration_number}</strong></div>}
              {emp.verification.submitted_at && <div className="text-muted">Submitted {formatDate(emp.verification.submitted_at)}</div>}
            </div>
          </div>
          <p className="small mt-2 mb-2">{emp.company_description}</p>
          {emp.verification.review_note && <p className="small text-muted">Review note: {emp.verification.review_note}</p>}
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {emp.verification.document && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => adminApi.downloadVerification(emp._id).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) }))}>
                <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true" />View document ({emp.verification.document.original_name})
              </button>
            )}
            {emp.verification.status === 'pending' && (
              <>
                <label htmlFor={`note-${emp._id}`} className="visually-hidden">Review note</label>
                <input id={`note-${emp._id}`} className="form-control form-control-sm" style={{ maxWidth: 300 }} placeholder="Note (required to reject)" value={notes[emp._id] || ''} onChange={(e) => setNotes({ ...notes, [emp._id]: e.target.value })} />
                <button type="button" className="btn btn-sm btn-success" disabled={busyId === emp._id} onClick={() => review(emp, 'approved')}>
                  <i className="bi bi-check-lg me-1" aria-hidden="true" />Approve
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === emp._id} onClick={() => review(emp, 'rejected')}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true" />Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function Users({ setMessage }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    (query, r) => adminApi.users({ q: query || undefined, role: r || undefined }).then((d) => setUsers(d.users)).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) })),
    [setMessage]
  );
  useEffect(() => {
    load('', '');
  }, [load]);

  const toggle = async (u) => {
    if (u.is_active && !(await confirm({ title: `Deactivate ${u.name}?`, message: 'They will not be able to log in as a job seeker or an employer, or register again with this email, until you activate it again.', confirmText: 'Deactivate', tone: 'danger' }))) return;
    setBusyId(u._id);
    try {
      const res = await adminApi.setUserStatus(u._id, !u.is_active);
      setMessage({ type: 'success', text: `${u.name}: ${res.message}` });
      // Both accounts on this email (job seeker and employer) change together
      const changed = new Map((res.users || [res.user]).map((x) => [x._id, x]));
      setUsers((list) => list.map((x) => changed.get(x._id) || x));
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); setUsers(null); load(q, role); }} role="search">
        <div className="col-md-6">
          <label htmlFor="user-q" className="visually-hidden">Search users</label>
          <input id="user-q" className="form-control" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label htmlFor="user-role" className="visually-hidden">Role</label>
          <select id="user-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="job_seeker">Job seekers</option>
            <option value="employer">Employers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="col-md-3 d-grid"><button type="submit" className="btn btn-primary">Search</button></div>
      </form>
      {!users && <Loader />}
      {users && (
        <div className="jn-card p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col" className="text-end">Action</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="fw-semibold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td><span className={`badge text-bg-${u.is_active ? 'success' : 'secondary'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span></td>
                    <td className="text-end">
                      {u.role !== 'admin' && (
                        <button type="button" className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`} disabled={busyId === u._id} onClick={() => toggle(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Jobs({ setMessage }) {
  const [jobs, setJobs] = useState(null);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () => adminApi.jobs({ moderation_status: filter || undefined }).then((d) => setJobs(d.jobs)).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) })),
    [filter, setMessage]
  );
  useEffect(() => {
    setJobs(null);
    load();
  }, [load]);

  const moderate = async (job, status) => {
    let note;
    if (status === 'removed') {
      note = window.prompt(`Reason for removing "${job.title}" (shown to the employer):`);
      if (note === null) return;
      if (!note.trim()) {
        setMessage({ type: 'warning', text: 'A reason is required to remove a job.' });
        return;
      }
    }
    setBusyId(job._id);
    try {
      const res = await adminApi.moderateJob(job._id, status, note?.trim());
      setMessage({ type: 'success', text: res.message });
      await load();
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <select className="form-select w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter jobs">
          <option value="">All jobs</option>
          <option value="active">Active</option>
          <option value="removed">Removed</option>
        </select>
      </div>
      {!jobs && <Loader />}
      {jobs && jobs.length === 0 && <EmptyState icon="briefcase" title="No jobs" text="No jobs match this filter." />}
      {jobs && jobs.length > 0 && (
        <div className="jn-card p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr><th scope="col">Job</th><th scope="col">Company</th><th scope="col">Type</th><th scope="col">Posted</th><th scope="col">Status</th><th scope="col" className="text-end">Moderation</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j._id}>
                    <td><Link to={`/jobs/${j._id}`} className="fw-semibold">{j.title}</Link>{j.moderation_note && <div className="small text-danger">{j.moderation_note}</div>}</td>
                    <td>{j.company_name}</td>
                    <td>{typeLabel(j.employment_type)}</td>
                    <td>{formatDate(j.createdAt)}</td>
                    <td><span className={`badge text-bg-${j.status === 'open' ? 'success' : 'secondary'}`}>{j.status}</span></td>
                    <td className="text-end">
                      {j.moderation_status === 'active' ? (
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === j._id} onClick={() => moderate(j, 'removed')}>Remove</button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-outline-success" disabled={busyId === j._id} onClick={() => moderate(j, 'active')}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'speedometer2', Component: Overview },
  { key: 'verifications', label: 'Employer verification', icon: 'shield-check', Component: Verifications },
  { key: 'users', label: 'Users', icon: 'people', Component: Users },
  { key: 'jobs', label: 'Job moderation', icon: 'briefcase', Component: Jobs },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [message, setMessage] = useState(null);
  const Active = TABS.find((t) => t.key === tab).Component;
  const [stats, setStats] = useState(null);

  // Numbers for the overview and the banner; refreshed when you come back to the overview tab
  useEffect(() => {
    if (tab !== 'overview') return;
    adminApi.stats().then((d) => setStats(d.stats)).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) }));
  }, [tab]);

  const reviewed = stats && stats.employers ? ((stats.employers - stats.pending_verifications) / stats.employers) * 100 : 100;

  return (
    <div className="container py-4 dash">
      <DashHero
        title="Admin panel"
        subtitle="Verify employers, manage users and moderate job listings."
        ring={stats ? { percent: reviewed, label: 'Employers reviewed' } : undefined}
      >
        {stats?.pending_verifications > 0 && (
          <button type="button" className="dash-hero-chip as-button" onClick={() => setTab('verifications')}>
            <span className="dash-pulse" aria-hidden="true" />
            {stats.pending_verifications} verification{stats.pending_verifications === 1 ? '' : 's'} waiting
          </button>
        )}
      </DashHero>
      <ul className="nav nav-pills dash-tabs gap-2 mb-4" role="tablist">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key} role="presentation">
            <button type="button" role="tab" aria-selected={tab === t.key} className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setMessage(null); }}>
              <i className={`bi bi-${t.icon} me-1`} aria-hidden="true" />{t.label}
            </button>
          </li>
        ))}
      </ul>
      {message && <FormAlert type={message.type} message={message.text} onClose={() => setMessage(null)} />}
      <Active setMessage={setMessage} stats={stats} />
    </div>
  );
}
