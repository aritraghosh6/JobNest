import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const img = (name) => `${process.env.PUBLIC_URL}/images/${name}`;

/**
 * Shared card for Log in, Register and Forgot password.
 * A photo panel sits beside the form and slides to the other side when you
 * switch between Log in and Register (it invites you to the other page).
 */
export default function AuthLayout({ title, subtitle, children }) {
  const { pathname } = useLocation();
  const isRegister = pathname.startsWith('/register');

  const panel = isRegister
    ? {
        image: 'auth-register.jpg',
        heading: 'Welcome back',
        text: 'Already have an account? Log in to see your matches and applications.',
        to: '/login',
        cta: 'Log in',
      }
    : {
        image: 'auth-login.jpg',
        heading: 'Hello there',
        text: 'New to JobNest? Create an account and find work that fits your skills and your style.',
        to: '/register',
        cta: 'Create account',
      };

  return (
    <div className="auth-shell">
      <div className={`auth-card ${isRegister ? 'is-register' : 'is-login'}`}>
        <aside
          className="auth-photo d-none d-lg-flex"
          style={{ backgroundImage: `url(${img(panel.image)})` }}
          aria-label={panel.heading}
        >
          <div className="auth-photo-inner">
            <h2 className="auth-photo-title">{panel.heading}</h2>
            <p className="auth-photo-text">{panel.text}</p>
            <Link to={panel.to} className="btn auth-photo-btn">{panel.cta}</Link>
          </div>
        </aside>

        <div className="auth-form-side">
          <div className="auth-form-wrap">
            <h1 className={`h3 fw-bold ${subtitle ? 'mb-1' : 'mb-3'}`}>{title}</h1>
            {subtitle && <p className="text-muted mb-3">{subtitle}</p>}
            {children}
            {/* On phones the photo panel is hidden, so offer the switch here */}
            <p className="small text-center text-muted mt-4 mb-0 d-lg-none">
              {isRegister ? 'Already have an account?' : 'New to JobNest?'}{' '}
              <Link to={panel.to} className="fw-semibold">{panel.cta}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
