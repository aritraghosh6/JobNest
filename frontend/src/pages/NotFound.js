import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <div className="display-1 fw-bold text-primary">404</div>
      <h1 className="h3">Page not found</h1>
      <p className="text-muted">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn btn-primary">Go to the home page</Link>
    </div>
  );
}
