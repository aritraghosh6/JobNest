import React, { useState } from "react";

/** Password box with a show/hide (eye) button and its error message. */
export default function PasswordInput({ id, name, value, onChange, onBlur, error, autoComplete, large = false }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`input-group has-validation ${large ? "input-group-lg" : ""}`}>
      <input
        id={id || name}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className={`form-control ${error ? "is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={`${name}-error`}
      />
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
      >
        <i className={`bi bi-eye${show ? "-slash" : ""}`} aria-hidden="true" />
      </button>
      <div id={`${name}-error`} className="invalid-feedback">{error}</div>
    </div>
  );
}
