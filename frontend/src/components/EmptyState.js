import React from 'react';

export default function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div className="jn-card text-center p-5 fade-up">
      <div className="icon-bubble mb-3 mx-auto" style={{ width: 64, height: 64, fontSize: '1.8rem' }}>
        <i className={`bi bi-${icon}`} aria-hidden="true" />
      </div>
      <h2 className="h5 fw-bold">{title}</h2>
      {text && <p className="text-muted mb-3">{text}</p>}
      {action}
    </div>
  );
}
