import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { applicationApi, jobApi } from "../../api/services";
import PageHeader from "../../components/PageHeader";
import Loader from "../../components/Loader";
import FormAlert from "../../components/FormAlert";
import EmptyState from "../../components/EmptyState";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import { ApplicationHistory, ApplicationStepper, NextStepCallout } from "../../components/ApplicationTimeline";
import {
  deadlineInfo,
  withdrawnAt,
  ACTIVE_STATUSES,
  APPLICATION_STATUS,
  EMPLOYER_NEXT_STATUS,
  INTERVIEW_MODES,
  formatDate,
  getErrorMessage,
  getFieldErrors,
  initials,
} from "../../utils/helpers";

const PIPELINE = ["submitted", "under_review", "shortlisted", "assessment", "interview", "hired", "rejected", "withdrawn"];

/** Smallest value for a datetime-local input: now, in the user's time zone. */
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function StatusForm({ app, onUpdated, onHired }) {
  const options = EMPLOYER_NEXT_STATUS[app.status] || [];
  const empty = { status: "", note: "", stage_label: "", scheduled_at: "", mode: "", location: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needsDetails = ["assessment", "interview"].includes(form.status);
  const isInterview = form.status === "interview";

  if (!options.length) return null;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.status) next.status = "Choose the next step.";
    if (isInterview && !form.scheduled_at) next.scheduled_at = "Choose the interview date and time.";
    if (isInterview && !form.mode) next.mode = "Choose how the interview will take place.";
    if (form.scheduled_at && form.scheduled_at < nowLocal()) next.scheduled_at = "The date and time cannot be in the past.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setError("");
    try {
      const body = { note: form.note.trim() || undefined };
      if (needsDetails) {
        body.stage_label = form.stage_label.trim() || undefined;
        body.scheduled_at = form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined;
        body.mode = form.mode || undefined;
        body.location = form.location.trim() || undefined;
      }
      const res = await applicationApi.setStatus(app.id, form.status, body);
      onUpdated(app.id, res.application, res.message);
      if (form.status === "hired") onHired?.();
      setForm(empty);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="status-form mt-3 pt-3 border-top" onSubmit={submit} noValidate>
      <div className="row g-2 align-items-start">
        <div className="col-md-4">
          <label htmlFor={`status-${app.id}`} className="form-label small fw-semibold">Move candidate to</label>
          <select
            id={`status-${app.id}`}
            className={`form-select form-select-sm ${errors.status ? "is-invalid" : ""}`}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">Choose the next step...</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {s === app.status ? `Another ${APPLICATION_STATUS[s].label.toLowerCase()} round` : APPLICATION_STATUS[s].label}
              </option>
            ))}
          </select>
          <div className="invalid-feedback">{errors.status}</div>
        </div>
        <div className="col-md-8">
          <label htmlFor={`note-${app.id}`} className="form-label small fw-semibold">Message to the candidate (optional)</label>
          <input
            id={`note-${app.id}`}
            className="form-control form-control-sm"
            maxLength={500}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={form.status === "rejected" ? "e.g. Thank you, we've chosen candidates with more SCADA experience." : "e.g. Please bring a copy of your portfolio."}
          />
        </div>
      </div>

      {needsDetails && (
        <div className="row g-2 mt-1 fade-up">
          <div className="col-md-4">
            <label htmlFor={`stage-${app.id}`} className="form-label small fw-semibold">Step name</label>
            <input
              id={`stage-${app.id}`}
              className="form-control form-control-sm"
              maxLength={80}
              value={form.stage_label}
              onChange={(e) => set("stage_label", e.target.value)}
              placeholder={isInterview ? "e.g. Technical interview - round 1" : "e.g. Take-home coding task"}
            />
          </div>
          <div className="col-md-4">
            <label htmlFor={`when-${app.id}`} className={`form-label small fw-semibold ${isInterview ? "required" : ""}`}>
              {isInterview ? "Date and time" : "Due by (optional)"}
            </label>
            <input
              id={`when-${app.id}`}
              type="datetime-local"
              min={nowLocal()}
              className={`form-control form-control-sm ${errors.scheduled_at ? "is-invalid" : ""}`}
              value={form.scheduled_at}
              onChange={(e) => set("scheduled_at", e.target.value)}
            />
            <div className="invalid-feedback">{errors.scheduled_at}</div>
          </div>
          <div className="col-md-4">
            <span className={`form-label small fw-semibold d-block ${isInterview ? "required" : ""}`} id={`mode-${app.id}`}>
              {isInterview ? "Interview type" : "Format (optional)"}
            </span>
            <div className="d-flex flex-wrap gap-1" role="radiogroup" aria-labelledby={`mode-${app.id}`}>
              {INTERVIEW_MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  role="radio"
                  aria-checked={form.mode === m.value}
                  className={`choice-chip small ${form.mode === m.value ? "active" : ""}`}
                  onClick={() => set("mode", form.mode === m.value ? "" : m.value)}
                >
                  <i className={`bi bi-${m.icon} me-1`} aria-hidden="true" />
                  {m.label.split(" (")[0]}
                </button>
              ))}
            </div>
            {errors.mode && <div className="invalid-feedback d-block">{errors.mode}</div>}
          </div>
          <div className="col-12">
            <label htmlFor={`where-${app.id}`} className="form-label small fw-semibold">
              {form.mode === "in_person" ? "Address" : "Meeting link or instructions"} (optional)
            </label>
            <input
              id={`where-${app.id}`}
              className="form-control form-control-sm"
              maxLength={300}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder={form.mode === "in_person" ? "e.g. 2nd floor, Sunrise House, Baner Road, Pune" : "e.g. https://meet.google.com/abc-defg-hij"}
            />
          </div>
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button type="submit" className={`btn btn-sm btn-${form.status === "rejected" ? "danger" : form.status === "hired" ? "success" : "primary"}`} disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
          {form.status === "hired" ? "Select candidate" : form.status === "rejected" ? "Send decision" : "Update and notify candidate"}
        </button>
        <span className="small text-muted">The candidate gets a notification straight away.</span>
      </div>
      {error && !Object.keys(errors).some((k) => errors[k]) && <div className="small text-danger mt-2" role="alert">{error}</div>}
    </form>
  );
}

function ApplicantCard({ app, onUpdated, onHired }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const p = app.profile;
  const score = app.match_score;

  const withdrawn = app.status === "withdrawn";
  const withdrawnOn = withdrawn ? withdrawnAt(app.status_history) : null;

  return (
    <article className={`jn-card app-card p-4 mb-3 status-${app.status} ${withdrawn ? "is-withdrawn" : ""}`}>
      {withdrawn && (
        <div className="withdrawn-note mb-3" role="note">
          <i className="bi bi-box-arrow-left" aria-hidden="true" />
          <span>
            <strong>Withdrawn by the candidate</strong>
            {withdrawnOn ? ` on ${formatDate(withdrawnOn)}` : ""}. This application no longer counts towards your applicant limit, and you can't change its status.
          </span>
        </div>
      )}
      <div className="d-flex flex-wrap gap-3 align-items-start">
        <span className="avatar" aria-hidden="true">{initials(p?.full_name || app.applicant?.name)}</span>
        <div className="flex-grow-1 min-w-0">
          <h2 className="h5 fw-bold mb-0">{p?.full_name || app.applicant?.name}</h2>
          {p?.headline && <div className="text-muted small">{p.headline}</div>}
          <div className="small text-muted">
            {app.applicant?.email}
            {p?.location && <> &middot; {p.location}</>} &middot; Applied {formatDate(app.createdAt)}
          </div>
        </div>
        <div className="text-end">
          <div className={`match-pill ${score >= 75 ? "high" : score >= 55 ? "mid" : "low"}`}>{score}% match</div>
          <div className="mt-1"><ApplicationStatusBadge status={app.status} /></div>
        </div>
      </div>

      <ApplicationStepper status={app.status} history={app.status_history} />
      <NextStepCallout status={app.status} history={app.status_history} />

      {p?.skills?.length > 0 && (
        <div className="mt-3">{p.skills.slice(0, 12).map((s) => <span key={s} className="skill-chip neutral">{s}</span>)}</div>
      )}

      <div className="d-flex flex-wrap gap-2 mt-2">
        {app.has_resume ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => applicationApi.downloadResume(app.id).catch((err) => setError(getErrorMessage(err)))}
          >
            <i className="bi bi-download me-1" aria-hidden="true" />Download resume
          </button>
        ) : (
          <span className="small text-muted align-self-center">No resume attached</span>
        )}
        <button type="button" className="btn btn-sm btn-light" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
          <i className={`bi bi-chevron-${expanded ? "up" : "down"} me-1`} aria-hidden="true" />
          {expanded ? "Hide details" : "Profile and history"}
        </button>
      </div>
      {error && <div className="small text-danger mt-2" role="alert">{error}</div>}

      {expanded && (
        <div className="row g-4 mt-1 fade-up">
          <div className="col-md-6">
            <h3 className="h6 fw-bold">Cover letter</h3>
            <p className="small" style={{ whiteSpace: "pre-line" }}>{app.cover_letter_text || "No cover letter provided."}</p>
            <h3 className="h6 fw-bold">Education</h3>
            {(p?.education || []).map((e, i) => (
              <div key={e._id || i} className="small">
                {e.degree} &middot; {e.institution} {e.end_year ? `(${e.end_year})` : ""}
              </div>
            ))}
            {!p?.education?.length && <div className="small text-muted">Not provided</div>}
            <h3 className="h6 fw-bold mt-3">Experience</h3>
            {(p?.experience || []).map((x, i) => (
              <div key={x._id || i} className="small mb-1">
                {x.title} &middot; {x.organization} <span className="text-muted text-capitalize">({x.type})</span>
              </div>
            ))}
            {!p?.experience?.length && <div className="small text-muted">Not provided</div>}
          </div>
          <div className="col-md-6">
            <h3 className="h6 fw-bold">Full history</h3>
            <ApplicationHistory history={app.status_history} viewer="employer" />
          </div>
        </div>
      )}

      <StatusForm app={app} onUpdated={onUpdated} onHired={onHired} />
    </article>
  );
}

export default function JobApplicantsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fillOpen, setFillOpen] = useState(false);
  const [fillMessage, setFillMessage] = useState("");
  const [fillBusy, setFillBusy] = useState(false);

  useEffect(() => {
    jobApi
      .applications(id)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const apps = useMemo(() => data?.applications || [], [data]);
  const counts = useMemo(() => {
    const c = {};
    apps.forEach((a) => {
      c[a.status] = (c[a.status] || 0) + 1;
    });
    return c;
  }, [apps]);
  const activeCount = apps.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
  const job = data?.job;
  const filled = job?.closed_reason === "filled";

  const onUpdated = (appId, updated, message) => {
    setData((d) => ({
      ...d,
      applications: d.applications.map((a) => (a.id === appId ? { ...a, status: updated.status, status_history: updated.status_history } : a)),
    }));
    setSuccess(message || "Status updated.");
  };

  const markFilled = async () => {
    setFillBusy(true);
    setError("");
    try {
      const res = await jobApi.markFilled(id, fillMessage.trim() || undefined);
      setSuccess(res.message);
      const fresh = await jobApi.applications(id);
      setData(fresh);
      setFillOpen(false);
      setFillMessage("");
    } catch (err) {
      setError(getErrorMessage(err));
      setFillOpen(false);
    } finally {
      setFillBusy(false);
    }
  };

  if (loading) return <Loader text="Loading applicants..." />;

  const list = apps.filter((a) => !filter || a.status === filter);
  const limit = job?.max_applicants;
  // Withdrawn applications don't count towards the total or the limit
  const counted = apps.filter((a) => a.status !== "withdrawn").length;
  const withdrawnCount = apps.length - counted;
  const deadline = deadlineInfo(job?.application_deadline, { prefix: "Applications close", pastPrefix: "Applications closed" });

  return (
    <div className="container py-4">
      <Link to="/employer/jobs" className="back-link"><i className="bi bi-arrow-left me-1" aria-hidden="true" />Back to my jobs</Link>
      <PageHeader
        icon="people"
        title={job ? `Applicants for ${job.title}` : "Applicants"}
        subtitle="Sorted by match score. Every update you make is sent to the candidate as a notification."
        actions={
          job && !filled && counted > 0 && (
            <button type="button" className="btn btn-success" onClick={() => setFillOpen(true)}>
              <i className="bi bi-person-check me-1" aria-hidden="true" />Mark position as filled
            </button>
          )
        }
      />

      <FormAlert message={error} onClose={() => setError("")} />
      <FormAlert type="success" message={success} onClose={() => setSuccess("")} />
      {filled && (
        <FormAlert type="info" message="This position has been filled. Candidates who were still in the process have been thanked and notified." />
      )}
      {!filled && job?.closed_reason === "limit_reached" && (
        <FormAlert type="warning" message={`This job reached its limit of ${limit} applications and is closed to new applicants.`}>
          {" "}<Link to={`/employer/jobs/${id}/edit`}>Increase the limit</Link> and reopen it from My jobs to accept more.
        </FormAlert>
      )}

      {job && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="jn-card p-3 h-100 stat-mini">
              <div className="text-muted small">Applications</div>
              <div className="fs-3 fw-bold">
                {counted}
                {limit ? <span className="fs-6 text-muted fw-normal"> / {limit}</span> : null}
              </div>
              {limit ? (
                <div className="progress mt-1" role="progressbar" aria-label="Applications against limit" aria-valuenow={counted} aria-valuemin={0} aria-valuemax={limit} style={{ height: 6 }}>
                  <div className={`progress-bar ${counted >= limit ? "bg-danger" : counted >= limit * 0.8 ? "bg-warning" : ""}`} style={{ width: `${Math.min(100, (counted / limit) * 100)}%` }} />
                </div>
              ) : (
                <div className="small text-muted">No applicant limit</div>
              )}
              {withdrawnCount > 0 && <div className="small text-muted mt-1">{withdrawnCount} withdrawn (not counted)</div>}
            </div>
          </div>
          <div className="col-md-4">
            <div className="jn-card p-3 h-100 stat-mini">
              <div className="text-muted small">Still in the process</div>
              <div className="fs-3 fw-bold">{activeCount}</div>
              <div className="small text-muted">{counts.interview || 0} at interview stage</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="jn-card p-3 h-100 stat-mini">
              <div className="text-muted small">Selected</div>
              <div className="fs-3 fw-bold text-success">{counts.hired || 0}</div>
              <div className={`small ${deadline.past ? "text-danger" : deadline.soon ? "text-warning-emphasis" : "text-muted"}`}>{deadline.text}</div>
            </div>
          </div>
        </div>
      )}

      {apps.length > 0 && (
        <div className="filter-pills mb-4" role="tablist" aria-label="Filter by stage">
          <button type="button" role="tab" aria-selected={!filter} className={`filter-pill ${!filter ? "active" : ""}`} onClick={() => setFilter("")}>
            All <span className="count">{apps.length}</span>
          </button>
          {PIPELINE.filter((s) => counts[s]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={filter === s} className={`filter-pill ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {APPLICATION_STATUS[s].short} <span className="count">{counts[s]}</span>
            </button>
          ))}
        </div>
      )}

      {data && list.length === 0 && (
        <EmptyState icon="people" title={filter ? "No candidates at this stage" : "No applicants yet"} text={filter ? "Choose another stage above." : "Applications from matching candidates will appear here."} />
      )}
      <div className="stagger">
        {list.map((a) => (
          <ApplicantCard key={a.id} app={a} onUpdated={onUpdated} onHired={() => !filled && activeCount > 1 && setFillOpen(true)} />
        ))}
      </div>

      <ConfirmDialog
        open={fillOpen}
        tone="success"
        title="Mark this position as filled?"
        message={`The job will close, and the ${activeCount} candidate${activeCount === 1 ? "" : "s"} still in the process will be thanked and told their application stays on file for future openings.`}
        confirmText="Mark as filled and notify"
        busy={fillBusy}
        onConfirm={markFilled}
        onCancel={() => setFillOpen(false)}
      >
        <label htmlFor="fill-message" className="form-label small fw-semibold">Personal message to them (optional)</label>
        <textarea
          id="fill-message"
          className="form-control"
          rows={3}
          maxLength={500}
          value={fillMessage}
          onChange={(e) => setFillMessage(e.target.value)}
          placeholder="e.g. It was a close decision, and we'd love to stay in touch."
        />
      </ConfirmDialog>
    </div>
  );
}
