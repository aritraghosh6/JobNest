import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { calendarApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import FormAlert from '../../components/FormAlert';
import { ROLES, getErrorMessage } from '../../utils/helpers';

/**
 * Calendar for job seekers and employers.
 * Job seeker: jobs from followed companies matching the roles you want, deadlines
 *   (highlighted from 3 days before if you haven't applied), applications,
 *   assessments, interviews and selections.
 * Employer (HR): jobs posted, closing dates, new applications, scheduled
 *   assessments and interviews, hires, a hiring pipeline and an HR to-do list.
 * Clicking an event opens the related page.
 */

const TYPES = {
  new_job: { label: 'New job from a company you follow', short: 'New job', icon: 'briefcase', tone: 'blue' },
  deadline: { label: 'Application deadline', short: 'Deadline', icon: 'alarm', tone: 'red' },
  deadline_applied: { label: 'Deadline (already applied)', short: 'Applied deadline', icon: 'check2-circle', tone: 'grey' },
  applied: { label: 'Application sent', short: 'Applied', icon: 'send-check', tone: 'violet' },
  assessment: { label: 'Assessment', short: 'Assessment', icon: 'clipboard-check', tone: 'amber' },
  interview: { label: 'Interview', short: 'Interview', icon: 'calendar-event', tone: 'amber' },
  shortlisted: { label: 'Shortlisted', short: 'Shortlisted', icon: 'star', tone: 'green' },
  selected: { label: 'Selected', short: 'Selected', icon: 'trophy', tone: 'green' },
  posted: { label: 'Job posted', short: 'Posted', icon: 'megaphone', tone: 'blue' },
  applications: { label: 'New applications', short: 'Applications', icon: 'inbox', tone: 'violet' },
};
const ROLE_TYPES = {
  [ROLES.JOB_SEEKER]: ['new_job', 'deadline', 'deadline_applied', 'applied', 'assessment', 'interview', 'shortlisted', 'selected'],
  [ROLES.EMPLOYER]: ['posted', 'deadline', 'applications', 'assessment', 'interview', 'selected'],
};
const PIPELINE = [
  { key: 'submitted', label: 'New', icon: 'inbox' },
  { key: 'under_review', label: 'Screening', icon: 'eye' },
  { key: 'shortlisted', label: 'Shortlisted', icon: 'star' },
  { key: 'assessment', label: 'Assessment', icon: 'clipboard-check' },
  { key: 'interview', label: 'Interview', icon: 'calendar-event' },
  { key: 'hired', label: 'Hired', icon: 'trophy' },
];
const HR_CHECKLIST = [
  'Write a clear job description with the must-have skills and salary range',
  'Set an application deadline and an applicant limit',
  'Screen new applications within 3 days',
  'Shortlist and book assessments or interviews',
  'Share interview details (time, place or link) with candidates',
  'Give feedback to candidates who are not selected',
  'Make the offer and mark the position as filled',
  'Onboard the new hire: documents, start date, first-week plan',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const sameDay = (a, b) => dayKey(a) === dayKey(b);

/** The 6-week grid (Monday first) that shows the given month. */
function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const timeOf = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const longDay = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function EventPill({ ev, onOpen, compact }) {
  const meta = TYPES[ev.type] || TYPES.applied;
  return (
    <button
      type="button"
      className={`cal-pill tone-${meta.tone} ${ev.highlight ? 'is-urgent' : ''} ${ev.done ? 'is-done' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(ev);
      }}
      title={`${ev.title}${ev.subtitle ? ` - ${ev.subtitle}` : ''}`}
    >
      <i className={`bi bi-${meta.icon}`} aria-hidden="true" />
      {!compact && <span className="cal-pill-text">{ev.title}</span>}
      <span className="visually-hidden">{compact ? ev.title : ''}</span>
    </button>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployer = user.role === ROLES.EMPLOYER;
  const types = ROLE_TYPES[user.role] || ROLE_TYPES[ROLES.JOB_SEEKER];

  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date());
  const [hidden, setHidden] = useState(() => new Set());
  const [data, setData] = useState({ events: [], todo: [], pipeline: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const grid = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(() => {
    const from = new Date(grid[0]);
    const to = new Date(grid[41]);
    to.setHours(23, 59, 59, 999);
    setLoading(true);
    setError('');
    calendarApi
      .get({ from: from.toISOString(), to: to.toISOString() })
      .then((d) => setData({ events: d.events || [], todo: d.todo || [], pipeline: d.pipeline || null }))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [grid]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => data.events.filter((e) => !hidden.has(e.type)), [data.events, hidden]);
  const byDay = useMemo(() => {
    const map = new Map();
    visible.forEach((e) => {
      const k = dayKey(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    return map;
  }, [visible]);

  const today = new Date();
  const dayEvents = byDay.get(dayKey(selected)) || [];
  const upcoming = visible.filter((e) => new Date(e.date) >= new Date(today.toDateString())).slice(0, 6);

  const open = (ev) => ev.link && navigate(ev.link);
  const toggleType = (t) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const shiftMonth = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + step);
    setSelected(next);
    if (next.getMonth() !== month.getMonth()) setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  return (
    <div className="container py-4 cal-page">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1"><i className="bi bi-calendar3 me-2" aria-hidden="true" />Calendar</h1>
          <p className="text-muted mb-0">
            {isEmployer
              ? 'Your jobs, closing dates, new applications, interviews and the hiring tasks that need you.'
              : 'New jobs from companies you follow, deadlines, your applications and upcoming assessments.'}
          </p>
        </div>
      </div>

      {/* Legend that also works as filters */}
      <div className="cal-legend mb-3" role="group" aria-label="Show or hide event types">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            className={`cal-legend-chip tone-${TYPES[t].tone} ${hidden.has(t) ? 'is-off' : ''}`}
            aria-pressed={!hidden.has(t)}
            onClick={() => toggleType(t)}
          >
            <i className={`bi bi-${TYPES[t].icon}`} aria-hidden="true" />
            {TYPES[t].short}
          </button>
        ))}
      </div>

      <FormAlert message={error} onClose={() => setError('')} />

      <div className="row g-4">
        <div className="col-xl-8">
          <section className="cal-stage">
            <span className="cal-blob b1" aria-hidden="true" />
            <span className="cal-blob b2" aria-hidden="true" />
            <span className="cal-blob b3" aria-hidden="true" />
            <div className="cal-glass">
              <header className="cal-head">
                <h2 className="cal-month" aria-live="polite">
                  {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="d-flex align-items-center gap-2">
                  {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status"><span className="visually-hidden">Loading</span></span>}
                  <button type="button" className="btn btn-sm cal-nav" onClick={goToday}>Today</button>
                  <button type="button" className="btn btn-sm cal-nav icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-sm cal-nav icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div className="cal-weekdays" aria-hidden="true">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>

              <div key={month.toISOString()} className="cal-grid" role="grid" aria-label="Days" tabIndex={0} onKeyDown={onGridKey}>
                {grid.map((d) => {
                  const events = byDay.get(dayKey(d)) || [];
                  const outside = d.getMonth() !== month.getMonth();
                  const urgent = events.some((e) => e.highlight);
                  return (
                    <div
                      key={d.toISOString()}
                      role="gridcell"
                      aria-selected={sameDay(d, selected)}
                      className={`cal-day ${outside ? 'is-outside' : ''} ${sameDay(d, today) ? 'is-today' : ''} ${sameDay(d, selected) ? 'is-selected' : ''} ${urgent ? 'has-urgent' : ''}`}
                      onClick={() => setSelected(d)}
                    >
                      <span className="cal-date">{d.getDate()}</span>
                      <div className="cal-events d-none d-md-flex">
                        {events.slice(0, 2).map((ev) => <EventPill key={ev.id} ev={ev} onOpen={open} />)}
                        {events.length > 2 && <span className="cal-more">+{events.length - 2} more</span>}
                      </div>
                      {events.length > 0 && (
                        <div className="cal-dots d-md-none" aria-label={`${events.length} event${events.length === 1 ? '' : 's'}`}>
                          {events.slice(0, 3).map((ev) => <span key={ev.id} className={`cal-dot tone-${(TYPES[ev.type] || TYPES.applied).tone}`} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="col-xl-4 d-flex flex-column gap-4">
          {/* Selected day */}
          <section className="jn-card p-4 cal-side" aria-labelledby="day-heading">
            <h2 id="day-heading" className="h6 fw-bold mb-3">{sameDay(selected, today) ? 'Today' : longDay(selected)}</h2>
            {dayEvents.length === 0 && <p className="small text-muted mb-0">Nothing on this day.</p>}
            <ul className="list-unstyled mb-0">
              {dayEvents.map((ev) => {
                const meta = TYPES[ev.type] || TYPES.applied;
                return (
                  <li key={ev.id}>
                    <button type="button" className={`cal-agenda-item tone-${meta.tone} ${ev.highlight ? 'is-urgent' : ''} ${ev.done ? 'is-done' : ''}`} onClick={() => open(ev)}>
                      <span className="cal-agenda-icon" aria-hidden="true"><i className={`bi bi-${meta.icon}`} /></span>
                      <span className="flex-grow-1 min-w-0 text-start">
                        <span className="d-block fw-semibold">{ev.title}</span>
                        <span className="d-block small text-muted">{ev.subtitle}</span>
                        <span className="d-block cal-agenda-meta">{meta.short} &middot; {timeOf(ev.date)}{ev.highlight ? ' \u00b7 Due soon' : ''}</span>
                      </span>
                      <i className="bi bi-chevron-right text-muted" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Needs attention */}
          <section className="jn-card p-4 cal-side" aria-labelledby="todo-heading">
            <h2 id="todo-heading" className="h6 fw-bold mb-3">
              <i className="bi bi-lightning-charge me-2" aria-hidden="true" />
              {isEmployer ? 'HR to-do' : 'Needs your attention'}
              {data.todo.length > 0 && <span className="badge rounded-pill text-bg-warning ms-2">{data.todo.length}</span>}
            </h2>
            {data.todo.length === 0 && <p className="small text-muted mb-0">You're all caught up.</p>}
            <ul className="list-unstyled mb-0">
              {data.todo.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <Link to={t.link || '#'} className={`cal-todo tone-${t.tone}`}>
                    <i className={`bi bi-${t.icon}`} aria-hidden="true" />
                    <span>
                      <span className="d-block fw-semibold">{t.title}</span>
                      <span className="d-block small text-muted">{t.subtitle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Seeker: coming up next */}
          {!isEmployer && (
            <section className="jn-card p-4 cal-side" aria-labelledby="next-heading">
              <h2 id="next-heading" className="h6 fw-bold mb-3"><i className="bi bi-clock-history me-2" aria-hidden="true" />Coming up this month</h2>
              {upcoming.length === 0 && <p className="small text-muted mb-0">Nothing scheduled yet.</p>}
              {upcoming.map((ev) => (
                <button key={ev.id} type="button" className="cal-upcoming" onClick={() => open(ev)}>
                  <span className="cal-upcoming-date">
                    <strong>{new Date(ev.date).getDate()}</strong>
                    <span>{new Date(ev.date).toLocaleDateString('en-GB', { month: 'short' })}</span>
                  </span>
                  <span className="min-w-0 text-start">
                    <span className="d-block fw-semibold text-truncate">{ev.title}</span>
                    <span className="d-block small text-muted text-truncate">{ev.subtitle}</span>
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>

      {/* Employer: hiring pipeline and checklist */}
      {isEmployer && (
        <div className="row g-4 mt-1">
          <div className="col-lg-7">
            <section className="jn-card p-4 h-100" aria-labelledby="pipe-heading">
              <h2 id="pipe-heading" className="h6 fw-bold mb-3"><i className="bi bi-diagram-3 me-2" aria-hidden="true" />Hiring pipeline (all jobs)</h2>
              <ol className="cal-pipeline list-unstyled mb-0">
                {PIPELINE.map((p) => (
                  <li key={p.key} className="cal-stage-step">
                    <span className="cal-stage-icon" aria-hidden="true"><i className={`bi bi-${p.icon}`} /></span>
                    <strong>{data.pipeline?.[p.key] ?? 0}</strong>
                    <span className="small text-muted">{p.label}</span>
                  </li>
                ))}
              </ol>
              <p className="small text-muted mt-3 mb-0">
                {data.pipeline?.rejected ? `${data.pipeline.rejected} candidate(s) were not selected. ` : ''}
                Open <Link to="/employer/jobs">My jobs</Link> to move candidates between stages.
              </p>
            </section>
          </div>
          <div className="col-lg-5">
            <section className="jn-card p-4 h-100" aria-labelledby="check-heading">
              <h2 id="check-heading" className="h6 fw-bold mb-3"><i className="bi bi-list-check me-2" aria-hidden="true" />Good hiring checklist</h2>
              <ol className="cal-checklist mb-0">
                {HR_CHECKLIST.map((c) => <li key={c}>{c}</li>)}
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
