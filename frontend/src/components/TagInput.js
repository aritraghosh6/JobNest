import React, { useState } from 'react';

/**
 * Text box that turns typed values into removable chips (skills, roles, values…).
 * Press Enter or comma to add.
 */
export default function TagInput({ id, label, value = [], onChange, placeholder, required, error, help, max = 30 }) {
  const [text, setText] = useState('');

  const add = (raw) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const existing = value.map((v) => v.toLowerCase());
    const next = [...value];
    items.forEach((item) => {
      if (!existing.includes(item.toLowerCase()) && next.length < max) next.push(item.slice(0, 60));
    });
    onChange(next);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="mb-3">
      {label && (
        <label htmlFor={id} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      <div className={`form-control d-flex flex-wrap align-items-center gap-1 ${error ? 'is-invalid' : ''}`} style={{ minHeight: 44 }}>
        {value.map((tag) => (
          <span className="skill-chip mb-0" key={tag}>
            {tag}
            <button
              type="button"
              className="btn btn-link p-0 ms-1 text-reset"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((v) => v !== tag))}
            >
              <i className="bi bi-x" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="border-0 flex-grow-1"
          style={{ outline: 'none', minWidth: 140 }}
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          aria-describedby={`${id}-help`}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <div className="invalid-feedback d-block">{error}</div>
      ) : (
        <div id={`${id}-help`} className="form-text">
          {help || 'Press Enter or comma after each item.'}
        </div>
      )}
    </div>
  );
}
