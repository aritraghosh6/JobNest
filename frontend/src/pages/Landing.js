import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const img = (name) => `${process.env.PUBLIC_URL}/images/${name}`;

// Hero carousel: one slide per JobNest feature (photos live in frontend/public/images)
const SLIDES = [
  { image: 'profiles.jpg', icon: 'person-badge', title: 'Professional profiles', text: 'Show your skills, education, experience and preferences in one place.' },
  { image: 'assessment.jpg', icon: 'clipboard-data', title: 'Work-style assessment', text: 'A short questionnaire that estimates your cultural fit with employers.' },
  { image: 'matching.jpg', icon: 'bullseye', title: 'Transparent matching', text: 'See only jobs that fit you, with a clear explanation of every match score.' },
  { image: 'ats.jpg', icon: 'file-earmark-check', title: 'ATS resume checker', text: 'Compare your resume with a job description and get honest improvement tips.' },
  { image: 'verified.jpg', icon: 'building-check', title: 'Verified employers', text: 'Companies are reviewed by an administrator before they can post jobs.' },
  { image: 'network.jpg', icon: 'people', title: 'Professional network', text: 'Connect with seekers and employers and message your connections.' },
];

const SCORE = [
  { image: 'skills.jpg', icon: 'tools', label: 'Skills', weight: 60, text: "Share of the job's required skills found in your profile." },
  { image: 'preferences.jpg', icon: 'sliders', label: 'Preferences', weight: 20, text: 'Location, job type and the roles you want.' },
  { image: 'culture.jpg', icon: 'people', label: 'Culture fit', weight: 20, text: 'Your assessment results compared with the team culture.' },
];

const STEPS = [
  { icon: 'person-plus', title: 'Build your profile', text: 'Add your skills, experience and the roles you want.' },
  { icon: 'clipboard-check', title: 'Take the assessment', text: 'Five minutes on how you like to work.' },
  { icon: 'send-check', title: 'Apply to matched jobs', text: 'Track every application from review to offer.' },
];

const AUTOPLAY_MS = 5000;
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function FeatureCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = SLIDES.length;

  const go = useCallback((i) => setIndex((i + count) % count), [count]);

  useEffect(() => {
    if (paused || reducedMotion()) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };

  return (
    <section
      className="feature-carousel"
      aria-roledescription="carousel"
      aria-label="JobNest features"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKey}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.title}
          className={`fc-slide ${i === index ? 'active' : ''}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}: ${s.title}`}
          aria-hidden={i !== index}
        >
          <img src={img(s.image)} alt="" className="fc-image" loading={i === 0 ? 'eager' : 'lazy'} />
          <div className="fc-caption">
            <span className="fc-chip"><i className={`bi bi-${s.icon} me-1`} aria-hidden="true" />Feature {i + 1} of {count}</span>
            <h2 className="fc-title">{s.title}</h2>
            <p className="fc-text mb-0">{s.text}</p>
          </div>
        </div>
      ))}

      <button type="button" className="fc-arrow prev" onClick={() => go(index - 1)} aria-label="Previous feature">
        <i className="bi bi-chevron-left" aria-hidden="true" />
      </button>
      <button type="button" className="fc-arrow next" onClick={() => go(index + 1)} aria-label="Next feature">
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>

      <div className="fc-dots" role="tablist" aria-label="Choose a feature">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.title}
            className={`fc-dot ${i === index ? 'active' : ''}`}
            onClick={() => go(i)}
          >
            {i === index && !paused && <span className="fc-dot-fill" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <>
      {/* 1. Hero: pitch on the left, feature carousel on the right */}
      <section className="hero py-5">
        <div className="container py-lg-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-6 fade-up">
              <span className="hero-badge mb-3">
                <i className="bi bi-lightning-charge-fill me-1" aria-hidden="true" />
                Energy, utilities and services careers
              </span>
              <h1 className="mb-3">
                Find work that fits your <span className="gradient-text">skills and your style.</span>
              </h1>
              <p className="lead text-muted mb-4">
                JobNest matches job seekers and employers on skills, preferences and cultural fit, and explains every match.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/register?role=job_seeker" className="btn btn-primary btn-lg">
                  <i className="bi bi-search me-2" aria-hidden="true" />I am looking for a job
                </Link>
                <Link to="/register?role=employer" className="btn btn-accent btn-lg">
                  <i className="bi bi-building me-2" aria-hidden="true" />I am hiring
                </Link>
              </div>
            </div>
            <div className="col-lg-6 fade-up" style={{ animationDelay: '0.15s' }}>
              <FeatureCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* 2. How the match score is calculated */}
      <section className="container py-5" aria-labelledby="score-heading">
        <div className="text-center mb-4">
          <span className="section-label">Transparent matching</span>
          <h2 id="score-heading" className="h3 fw-bold">How your match score is calculated</h2>
          <p className="text-muted mb-0">Only jobs that match you are shown, and every score comes with an explanation.</p>
        </div>
        <div className="row g-4 stagger">
          {SCORE.map((s) => (
            <div className="col-md-4" key={s.label}>
              <article className="jn-card jn-card-hover score-card h-100">
                <div className="score-photo">
                  <img src={img(s.image)} alt="" loading="lazy" />
                  <span className="score-weight">{s.weight}%</span>
                </div>
                <div className="p-4">
                  <h3 className="h6 fw-bold mb-1"><i className={`bi bi-${s.icon} me-2`} aria-hidden="true" />{s.label}</h3>
                  <p className="small text-muted mb-3">{s.text}</p>
                  <div className="progress" style={{ height: 8 }} role="img" aria-label={`${s.label} counts for ${s.weight}% of the score`}>
                    <div className="progress-bar" style={{ width: `${s.weight}%` }} />
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="container py-5" aria-labelledby="how-heading">
        <div className="jn-card how-card p-4 p-lg-5">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="section-label">Three simple steps</span>
              <h2 id="how-heading" className="h3 fw-bold mb-4">How JobNest works</h2>
              <ol className="how-steps list-unstyled mb-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="how-step">
                    <span className="how-num" aria-hidden="true">{i + 1}</span>
                    <div>
                      <div className="fw-bold"><i className={`bi bi-${s.icon} me-2`} aria-hidden="true" />{s.title}</div>
                      <div className="small text-muted">{s.text}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/register" className="btn btn-primary btn-lg">
                Join JobNest<i className="bi bi-arrow-right ms-2" aria-hidden="true" />
              </Link>
            </div>
            <div className="col-lg-5 d-none d-lg-block">
              <img src={img('how-it-works.jpg')} alt="" className="how-illustration" loading="lazy" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
