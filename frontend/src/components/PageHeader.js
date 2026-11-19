import React from 'react';

export default function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="page-header d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div className="d-flex align-items-center gap-3">
        {icon && (
          <span className="icon-bubble" aria-hidden="true">
            <i className={`bi bi-${icon}`} />
          </span>
        )}
        <div>
          <h1 className="h3 mb-1">{title}</h1>
          {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
