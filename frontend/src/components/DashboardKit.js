import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared building blocks for the three dashboards (job seeker, employer, admin):
 *  - CountUp:   numbers count up from 0 when the card appears
 *  - StatTile:  stat card with a coloured accent, count-up number and hover shine
 *  - DashHero:  greeting banner with the date, a short summary and a progress ring
 * All motion is switched off when the computer is set to "reduce motion".
 */

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CountUp({ value, duration = 900 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reducedMotion() ? target : 0);
  const frame = useRef(null);

  useEffect(() => {
    if (reducedMotion() || target === 0) {
      setShown(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setShown(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return <span aria-label={String(target)}>{shown.toLocaleString('en-GB')}</span>;
}

/** tone: 'yellow' | 'blue' | 'green' | 'violet' | 'rose' */
export function StatTile({ icon, label, value, to, tone = 'yellow', hint }) {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const body = (
    <div className={`jn-card stat-card dash-stat tone-${tone} p-4 h-100`}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="icon-bubble dash-icon" aria-hidden="true"><i className={`bi bi-${icon}`} /></span>
        {to && <i className="bi bi-arrow-up-right dash-go" aria-hidden="true" />}
      </div>
      <div className={`stat-value ${isNumber ? '' : 'is-text'}`}>{isNumber ? <CountUp value={value} /> : value ?? '-'}</div>
      <div className="text-muted small">{label}</div>
      {hint && <div className="dash-hint">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="text-decoration-none text-reset d-block h-100">{body}</Link> : body;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Progress ring, e.g. how much of the profile setup is done. */
export function ProgressRing({ percent = 0, label, size = 112 }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="dash-ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${p}%`}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle className="dash-ring-track" cx="50" cy="50" r={r} />
        <circle className="dash-ring-value" cx="50" cy="50" r={r} strokeDasharray={c} style={{ '--ring-offset': c * (1 - p / 100), '--ring-full': c }} />
      </svg>
      <div className="dash-ring-label">
        <strong><CountUp value={p} />%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

/**
 * Greeting banner at the top of a dashboard.
 * name: first name or company; ring: { percent, label } (optional); actions: buttons (optional)
 */
export function DashHero({ name, title, subtitle, ring, actions, children }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <section className="dash-hero mb-4">
      <span className="dash-hero-orb o1" aria-hidden="true" />
      <span className="dash-hero-orb o2" aria-hidden="true" />
      <div className="dash-hero-body">
        <div className="dash-hero-date"><i className="bi bi-calendar3 me-2" aria-hidden="true" />{today}</div>
        <h1 className="dash-hero-title">{title || `${greeting()}, ${name}`}</h1>
        {subtitle && <p className="dash-hero-sub">{subtitle}</p>}
        {children}
        {actions && <div className="d-flex flex-wrap gap-2 mt-3">{actions}</div>}
      </div>
      {ring && (
        <div className="dash-hero-ring">
          <ProgressRing percent={ring.percent} label={ring.label} />
        </div>
      )}
    </section>
  );
}
