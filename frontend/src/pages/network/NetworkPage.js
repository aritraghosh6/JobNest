import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { networkApi } from '../../api/services';
import { useConfirm } from '../../components/ConfirmDialog';
import { API_ORIGIN } from '../../api/client';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import { ROLE_LABELS, formatDate, getErrorMessage, initials } from '../../utils/helpers';

function UserBadge({ user }) {
  return (
    <div className="d-flex align-items-center gap-3">
      {user.logo_url ? (
        <img src={`${API_ORIGIN}${user.logo_url}`} alt="" className="company-logo" style={{ width: 44, height: 44 }} />
      ) : (
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
      )}
      <div className="min-w-0">
        <div className="fw-semibold">
          {user.name}
          {user.verified && <i className="bi bi-patch-check-fill text-primary ms-1" title="Verified employer" aria-label="Verified employer" />}
        </div>
        <div className="small text-muted text-truncate">{user.headline}</div>
        <div className="small text-muted">{ROLE_LABELS[user.role]}{user.location ? ` · ${user.location}` : ''}</div>
      </div>
    </div>
  );
}

export default function NetworkPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState('discover');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [users, setUsers] = useState([]);
  const [network, setNetwork] = useState({ connections: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadNetwork = useCallback(() => networkApi.connections().then(setNetwork), []);
  const loadUsers = useCallback(
    (q = query, r = role) => networkApi.discover({ q: q || undefined, role: r || undefined }).then((d) => setUsers(d.users)),
    [query, role]
  );

  useEffect(() => {
    Promise.all([loadNetwork(), loadUsers('', '')])
      .catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (id, action, successText) => {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await action();
      setMessage({ type: 'success', text: successText || res.message });
      await Promise.all([loadNetwork(), loadUsers()]);
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const onSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    loadUsers()
      .catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  };

  const actionFor = (u) => {
    const c = u.connection;
    const busy = busyId === u.id;
    if (c.status === 'connected') {
      return <Link to={`/messages/${u.id}`} className="btn btn-sm btn-outline-primary"><i className="bi bi-chat-dots me-1" aria-hidden="true" />Message</Link>;
    }
    if (c.status === 'pending_sent') {
      return <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => run(u.id, () => networkApi.remove(c.connection_id))}>Cancel request</button>;
    }
    if (c.status === 'pending_received') {
      return <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(u.id, () => networkApi.respond(c.connection_id, 'accept'))}>Accept request</button>;
    }
    return (
      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(u.id, () => networkApi.connect(u.id))}>
        {busy && <Loader small />}<i className="bi bi-person-plus me-1" aria-hidden="true" />Connect
      </button>
    );
  };

  const TABS = [
    { key: 'discover', label: 'Discover people' },
    { key: 'requests', label: `Requests (${network.incoming.length})` },
    { key: 'connections', label: `My connections (${network.connections.length})` },
  ];

  return (
    <div className="container py-4">
      <PageHeader icon="people" title="Network" subtitle="Connect with job seekers and employers, then message your connections." />
      {message && <FormAlert type={message.type} message={message.text} onClose={() => setMessage(null)} />}

      <ul className="nav nav-pills mb-4 gap-2" role="tablist">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key} role="presentation">
            <button type="button" role="tab" aria-selected={tab === t.key} className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {loading && <Loader />}

      {!loading && tab === 'discover' && (
        <>
          <form className="row g-2 mb-3" onSubmit={onSearch} role="search">
            <div className="col-md-6">
              <label htmlFor="people-q" className="visually-hidden">Search by name</label>
              <input id="people-q" className="form-control" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="people-role" className="visually-hidden">Role</label>
              <select id="people-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Everyone</option>
                <option value="job_seeker">Job seekers</option>
                <option value="employer">Employers</option>
              </select>
            </div>
            <div className="col-md-3 d-grid"><button type="submit" className="btn btn-primary">Search</button></div>
          </form>
          {users.length === 0 ? (
            <EmptyState icon="person-x" title="No people found" text="Try a different name or role." />
          ) : (
            <div className="row g-3 stagger">
              {users.map((u) => (
                <div className="col-md-6 col-lg-4" key={u.id}>
                  <div className="jn-card jn-card-hover p-3 h-100 d-flex flex-column gap-3">
                    <UserBadge user={u} />
                    {u.skills?.length > 0 && <div>{u.skills.map((s) => <span key={s} className="skill-chip neutral">{s}</span>)}</div>}
                    <div className="mt-auto">{actionFor(u)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && tab === 'requests' && (
        <div className="row g-4">
          <div className="col-lg-6">
            <h2 className="h6 fw-bold">Received</h2>
            {network.incoming.length === 0 && <p className="text-muted small">No pending requests.</p>}
            {network.incoming.map((c) => (
              <div key={c.id} className="jn-card p-3 mb-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <UserBadge user={c.user} />
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-primary" disabled={busyId === c.id} onClick={() => run(c.id, () => networkApi.respond(c.id, 'accept'))}>Accept</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busyId === c.id} onClick={() => run(c.id, () => networkApi.respond(c.id, 'reject'))}>Decline</button>
                </div>
              </div>
            ))}
          </div>
          <div className="col-lg-6">
            <h2 className="h6 fw-bold">Sent</h2>
            {network.outgoing.length === 0 && <p className="text-muted small">No sent requests waiting for a reply.</p>}
            {network.outgoing.map((c) => (
              <div key={c.id} className="jn-card p-3 mb-2 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <UserBadge user={c.user} />
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busyId === c.id} onClick={() => run(c.id, () => networkApi.remove(c.id))}>Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'connections' && (
        network.connections.length === 0 ? (
          <EmptyState icon="people" title="No connections yet" text="Send requests from the Discover tab." />
        ) : (
          <div className="row g-3 stagger">
            {network.connections.map((c) => (
              <div className="col-md-6" key={c.id}>
                <div className="jn-card p-3 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                  <div>
                    <UserBadge user={c.user} />
                    <div className="small text-muted mt-1">Connected since {formatDate(c.since)}</div>
                  </div>
                  <div className="d-flex gap-2">
                    <Link to={`/messages/${c.user.id}`} className="btn btn-sm btn-primary">Message</Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busyId === c.id}
                      onClick={async () => (await confirm({ title: `Remove ${c.user.name}?`, message: 'You will no longer be connected and cannot message each other.', confirmText: 'Remove connection', tone: 'danger' })) && run(c.id, () => networkApi.remove(c.id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
