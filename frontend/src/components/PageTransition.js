import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Re-mounts its children on every route change so the CSS "page-transition"
 * animation plays. Motion is disabled automatically for prefers-reduced-motion.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}
