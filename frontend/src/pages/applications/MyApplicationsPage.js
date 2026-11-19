import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { applicationApi } from "../../api/services";
import PageHeader from "../../components/PageHeader";
import Loader from "../../components/Loader";
import FormAlert from "../../components/FormAlert";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import { ApplicationHistory, ApplicationStepper, NextStepCallout } from "../../components/ApplicationTimeline";
import { ACTIVE_STATUSES, APPLICATION_STATUS, formatDate, getErrorMessage, typeLabel } from "../../utils/helpers";

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "In progress" },
  { value: "interview", label: "Interviews" },
  { value: "hired", label: "Selected" },
  { value: "closed", label: "Closed" },
];

function ApplicationCard({ app, onWithdraw }) {
  const [open, setOpen] = useState(false);
  const job = app.job;
  const statusMeta = APPLICATION_STATUS[app.status];

  return (
    <article className={`jn-card app-card p-4 mb-3 status-${app.status}`}>
      <div className="d-flex flex-wrap gap-3 align-items-start">
        <span className="icon-bubble" aria-hidden="true"><i className="bi bi-briefcase" /></span>
        <div className="flex-grow-1 min-w-0">
          <h2 className="h5 fw-bold mb-1">
            {job ? <Link to={`/jobs/${job._id}`} className="text-reset">{job.title}</Link> : "Job no longer available"}
          </h2>
          {job && (
            <div className="small text-muted">
              {job.company_name} · {job.location} · {typeLabel(job.employment_type)}
            </div>
          )}
          <div className="small text-muted mt-1">
            Applied {formatDate(app.createdAt)} · {app.match_score}% match
            {app.has_resume ? " · Resume attached" : " · No resume attached"}
          </div>
        </div>
        <div className="text-end">
          <ApplicationStatusBadge status={app.status} />
          {job && job.status !== "open" && ACTIVE_STATUSES.includes(app.status) && (
            <div className="small text-muted mt-1">{job.closed_reason === "filled" ? "Position filled" : "No longer accepting applications"}</div>
          )}
        </div>
      </div>

      <ApplicationStepper status={app.status} history={app.status_history} />
      <NextStepCallout status={app.status} history={app.status_history} />

      {app.status === "position_filled" && (
        <p className="small text-muted mb-0 mt-2">
          {job?.company_name || "The employer"} has found the candidate for this role. Thank you for your time. Your application stays with them, and they'll let you know if it matches another opening.
        </p>
      )}
      {app.status === "hired" && (
        <p className="small text-success fw-semibold mb-0 mt-2">
          <i className="bi bi-stars me-1" aria-hidden="true" />Congratulations! {job?.company_name || "The employer"} will contact you about the next steps.
        </p>
      )}

      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-sm btn-light" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <i className={`bi bi-chevron-${open ? "up" : "down"} me-1`} aria-hidden="true" />
          {open ? "Hide" : "Show"} full history
        </button>
        {ACTIVE_STATUSES.includes(app.status) && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onWithdraw(app)}>
            Withdraw
          </button>
        )}
      </div>
      {open && (
        <div className="fade-up mt-3">
          <ApplicationHistory history={app.status_history} />
          {statusMeta && <span className="visually-hidden">Current status: {statusMeta.label}</span>}
        </div>
      )}
    </article>
  );
}

export default function MyApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toWithdraw, setToWithdraw] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applicationApi
      .mine({})
      .then((d) => setApps(d.applications))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      "": apps.length,
      active: apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
      interview: apps.filter((a) => a.status === "interview").length,
      hired: apps.filter((a) => a.status === "hired").length,
      closed: apps.filter((a) => !ACTIVE_STATUSES.includes(a.status) && a.status !== "hired").length,
    }),
    [apps]
  );

  const shown = apps.filter((a) => {
    if (!filter) return true;
    if (filter === "active") return ACTIVE_STATUSES.includes(a.status);
    if (filter === "closed") return !ACTIVE_STATUSES.includes(a.status) && a.status !== "hired";
    return a.status === filter;
  });

  const confirmWithdraw = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await applicationApi.withdraw(toWithdraw.id);
      setApps((list) => list.map((a) => (a.id === toWithdraw.id ? { ...a, ...res.application, job: a.job } : a)));
      setSuccess("Your application has been withdrawn.");
      setToWithdraw(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setToWithdraw(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-4">
      <PageHeader icon="send-check" title="My applications" subtitle="Follow every application from submission to decision." />

      <div className="filter-pills mb-4" role="tablist" aria-label="Filter applications">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`filter-pill ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label} <span className="count">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      <FormAlert message={error} onClose={() => setError("")} />
      <FormAlert type="success" message={success} onClose={() => setSuccess("")} />
      {loading && <Loader text="Loading your applications…" />}
      {!loading && shown.length === 0 && (
        <EmptyState
          icon="send"
          title={filter ? "Nothing here yet" : "No applications yet"}
          text={filter ? "No applications match this filter." : "When you apply for a matched job, you can follow its progress here."}
          action={!filter && <Link to="/jobs" className="btn btn-primary">Find jobs</Link>}
        />
      )}
      {!loading && <div className="stagger">{shown.map((a) => <ApplicationCard key={a.id} app={a} onWithdraw={setToWithdraw} />)}</div>}

      <ConfirmDialog
        open={Boolean(toWithdraw)}
        tone="danger"
        title="Withdraw this application?"
        message={toWithdraw ? `Your application for ${toWithdraw.job?.title || "this job"} will be withdrawn. This can't be undone.` : ""}
        confirmText="Withdraw application"
        busy={busy}
        onConfirm={confirmWithdraw}
        onCancel={() => setToWithdraw(null)}
      />
    </div>
  );
}
