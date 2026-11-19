import React from 'react';
import { APPLICATION_STATUS, VERIFICATION } from '../utils/helpers';

export function ApplicationStatusBadge({ status }) {
  const s = APPLICATION_STATUS[status] || { label: status, color: 'secondary', icon: 'circle' };
  return (
    <span className={`badge rounded-pill text-bg-${s.color}`}>
      <i className={`bi bi-${s.icon} me-1`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function VerificationBadge({ status }) {
  const s = VERIFICATION[status] || VERIFICATION.not_submitted;
  return (
    <span className={`badge rounded-pill text-bg-${s.color}`}>
      <i className={`bi bi-${s.icon} me-1`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
