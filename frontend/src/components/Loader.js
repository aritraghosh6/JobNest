import React from 'react';

export default function Loader({ text = 'Loading…', small = false }) {
  if (small) {
    return <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />;
  }
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted" role="status" aria-live="polite">
      <div className="spinner-border text-primary mb-3" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
