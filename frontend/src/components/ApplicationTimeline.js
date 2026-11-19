import React from "react";
import { APPLICATION_STATUS, formatDateTime, modeLabel } from "../utils/helpers";

/* The milestones every application moves through, like LinkedIn / Glassdoor. */
const MILESTONES = [
  { key: "submitted", label: "Applied", icon: "send" },
  { key: "under_review", label: "In review", icon: "eye" },
  { key: "shortlisted", label: "Shortlisted", icon: "star" },
  { key: "assessment", label: "Assessment", icon: "clipboard-check" },
  { key: "interview", label: "Interview", icon: "calendar-event" },
  { key: "decision", label: "Decision", icon: "flag" },
];

const DECISION = {
  hired: { state: "success", label: "Selected", icon: "trophy-fill" },
  rejected: { state: "failed", label: "Not selected", icon: "x-lg" },
  withdrawn: { state: "closed", label: "Withdrawn", icon: "arrow-counterclockwise" },
  position_filled: { state: "closed", label: "Position filled", icon: "person-check" },
};

/** Works out the state of each milestone: done, current, skipped, upcoming, success, failed or closed. */
export function milestoneStates(status, history = []) {
  const reached = new Set(history.map((h) => h.status));
  reached.add("submitted");
  const lastIndex = MILESTONES.reduce((max, m, i) => (reached.has(m.key) ? i : max), 0);
  const decision = DECISION[status];
  return MILESTONES.map((m, i) => {
    if (m.key === "decision") {
      return decision ? { ...m, state: decision.state, label: decision.label, icon: decision.icon } : { ...m, state: "upcoming" };
    }
    if (reached.has(m.key)) return { ...m, state: !decision && i === lastIndex ? "current" : "done" };
    if (i < lastIndex) return { ...m, state: "skipped" };
    return { ...m, state: decision ? "skipped" : "upcoming" };
  });
}

/** The next scheduled assessment or interview that is still in the future, if any. */
export function upcomingStep(status, history = []) {
  if (!["assessment", "interview"].includes(status)) return null;
  const last = [...history].reverse().find((h) => h.status === status);
  if (!last?.scheduled_at || new Date(last.scheduled_at) < new Date()) return null;
  return last;
}

const isLink = (text) => /^https?:\/\//i.test(String(text || "").trim());

/** Horizontal progress tracker. */
export function ApplicationStepper({ status, history }) {
  const steps = milestoneStates(status, history);
  // The line runs up to the furthest step reached (skipped steps in between are passed over)
  const furthest = steps.reduce((max, s, i) => (["done", "current", "success", "failed", "closed"].includes(s.state) ? i : max), 0);
  const progress = (furthest / (steps.length - 1)) * 100;
  const current = APPLICATION_STATUS[status]?.label || status;
  return (
    <div className="app-stepper" role="group" aria-label={`Application progress: ${current}`}>
      <div className="app-stepper-track" aria-hidden="true">
        <span className={`app-stepper-fill ${DECISION[status]?.state || ""}`} style={{ width: `${progress}%` }} />
      </div>
      <ol className="app-stepper-steps">
        {steps.map((s) => (
          <li key={s.key} className={`app-step ${s.state}`}>
            <span className="app-step-dot" aria-hidden="true">
              <i className={`bi bi-${s.state === "done" ? "check-lg" : s.icon}`} />
            </span>
            <span className="app-step-label">
              {s.label}
              <span className="visually-hidden">
                {s.state === "done" && " (completed)"}
                {s.state === "current" && " (current step)"}
                {s.state === "skipped" && " (not needed)"}
                {s.state === "upcoming" && " (not reached yet)"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** "Next step" call-out for a scheduled interview or assessment. */
export function NextStepCallout({ status, history }) {
  const next = upcomingStep(status, history);
  if (!next) return null;
  const isInterview = next.status === "interview";
  return (
    <div className="next-step pop-in">
      <span className="next-step-icon" aria-hidden="true">
        <i className={`bi bi-${isInterview ? "calendar-event" : "clipboard-check"}`} />
      </span>
      <div>
        <div className="fw-semibold">{next.stage_label || (isInterview ? "Interview" : "Assessment")}</div>
        <div className="small">
          {isInterview ? "When: " : "Due: "}
          <strong>{formatDateTime(next.scheduled_at)}</strong>
          {next.mode && <> &middot; {modeLabel(next.mode)}</>}
        </div>
        {next.location && (
          <div className="small text-break">
            {isLink(next.location) ? (
              <a href={next.location} target="_blank" rel="noreferrer">
                Join / open link <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              </a>
            ) : (
              next.location
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Vertical, detailed history: every step with its date, note and interview details. */
/** viewer: "seeker" or "employer" - only changes the wording of who withdrew. */
export function ApplicationHistory({ history = [], viewer = "seeker" }) {
  return (
    <ol className="app-history">
      {history.map((h, i) => {
        const meta = APPLICATION_STATUS[h.status] || { label: h.status, icon: "circle", color: "secondary" };
        return (
          <li key={i} className={`app-history-item text-${meta.color === "dark" ? "secondary" : meta.color}`}>
            <span className="app-history-dot" aria-hidden="true">
              <i className={`bi bi-${meta.icon}`} />
            </span>
            <div className="app-history-body">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <span className="fw-semibold text-body">{h.status === "withdrawn" ? (viewer === "employer" ? "Withdrawn by the candidate" : "You withdrew this application") : h.stage_label || meta.label}</span>
                <span className="small text-muted">{formatDateTime(h.changed_at)}</span>
              </div>
              {h.scheduled_at && (
                <div className="small text-body">
                  <i className="bi bi-clock me-1" aria-hidden="true" />
                  {h.status === "interview" ? "Scheduled for " : "Due "}
                  {formatDateTime(h.scheduled_at)}
                  {h.mode && ` \u00b7 ${modeLabel(h.mode)}`}
                </div>
              )}
              {h.location && (
                <div className="small text-body text-break">
                  <i className="bi bi-geo-alt me-1" aria-hidden="true" />
                  {isLink(h.location) ? (
                    <a href={h.location} target="_blank" rel="noreferrer">{h.location}</a>
                  ) : (
                    h.location
                  )}
                </div>
              )}
              {h.note && <div className="small text-body fst-italic mt-1">"{h.note}"</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
