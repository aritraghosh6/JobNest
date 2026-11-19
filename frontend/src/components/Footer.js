import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Quick links for each role (only pages that exist in App.js)
const LINKS = {
  guest: [
    { to: '/', label: 'Home' },
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Create account' },
  ],
  job_seeker: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/applications', label: 'Applications' },
    { to: '/messages', label: 'Messages' },
    { to: '/notifications', label: 'Notifications' },
  ],
  employer: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/employer/jobs', label: 'My jobs' },
    { to: '/company', label: 'Company' },
    { to: '/messages', label: 'Messages' },
    { to: '/notifications', label: 'Notifications' },
  ],
  admin: [{ to: '/admin', label: 'Admin panel' }],
};

/** Footer with a wave on top, quick links and the matching disclaimer. */
export default function Footer() {
  const { user } = useAuth();
  const links = LINKS[user?.role] || LINKS.guest;

  return (
    <footer className="footer site-footer">
      <svg className="footer-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="wave-back" d="M0,64 C240,112 480,16 720,48 C960,80 1200,120 1440,72 L1440,120 L0,120 Z" />
        <path className="wave-front" d="M0,88 C260,40 520,120 780,92 C1040,64 1240,40 1440,84 L1440,120 L0,120 Z" />
      </svg>
      <div className="footer-body">
        <div className="container">
          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
            <Link to={user ? '/dashboard' : '/'} className="footer-brand">
              <i className="bi bi-house-heart-fill me-2" aria-hidden="true" />JobNest
            </Link>
            <nav aria-label="Footer">
              <ul className="footer-links">
                {links.map((l) => (
                  <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                ))}
              </ul>
            </nav>
            <button
              type="button"
              className="footer-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Back to top"
              title="Back to top"
            >
              <i className="bi bi-arrow-up" aria-hidden="true" />
            </button>
          </div>
          <div className="footer-meta">
            <span>{'\u00A9'} {new Date().getFullYear()} JobNest - Built with the MERN stack</span>
            <span>Matching scores are rule-based estimates to support, not replace, human decisions.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
