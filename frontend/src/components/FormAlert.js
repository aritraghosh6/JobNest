import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ICONS = { danger: 'x-octagon-fill', success: 'check-circle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
const TOAST_MS = 4500;

/** Adds a full stop to messages that don't end with punctuation, so every message reads as a sentence. */
const sentence = (text) => (typeof text === 'string' && /[A-Za-z0-9)]$/.test(text.trim()) ? `${text.trim()}.` : text);

/** One shared corner on the screen where success toasts stack up. */
function toastRoot() {
  let el = document.getElementById('jn-toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'jn-toasts';
    el.className = 'jn-toasts';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Green toast in the top-right corner. Disappears by itself after a few seconds
 * (the timer pauses while the mouse is over it), or with the close button.
 */
function Toast({ message, children, onClose }) {
  const [hidden, setHidden] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // A new message shows the toast again
  useEffect(() => {
    setHidden(false);
    setLeaving(false);
  }, [message]);

  useEffect(() => {
    if (paused || leaving || hidden) return undefined;
    const t = setTimeout(() => setLeaving(true), TOAST_MS);
    return () => clearTimeout(t);
  }, [paused, leaving, hidden, message]);

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => {
      setHidden(true);
      if (closeRef.current) closeRef.current();
    }, 260);
    return () => clearTimeout(t);
  }, [leaving]);

  if (hidden) return null;
  return createPortal(
    <div
      className={`jn-toast ${leaving ? 'leaving' : ''} ${paused ? 'paused' : ''}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="jn-toast-icon" aria-hidden="true"><i className="bi bi-check-lg" /></span>
      <div className="jn-toast-text">
        {sentence(message)}
        {children}
      </div>
      <button type="button" className="jn-toast-close" aria-label="Dismiss message" onClick={() => setLeaving(true)}>
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
      <span className="jn-toast-timer" style={{ animationDuration: `${TOAST_MS}ms` }} aria-hidden="true" />
    </div>,
    toastRoot()
  );
}

/**
 * Message box.
 *  - success: a green toast in the corner that fades away (no box in the page)
 *  - danger / warning / info: shown in the page, next to what it is about
 * Screen readers announce both.
 */
export default function FormAlert({ type = 'danger', message, onClose, children }) {
  if (!message && !children) return null;
  if (type === 'success') return <Toast message={message} onClose={onClose}>{children}</Toast>;
  return (
    <div className={`alert alert-${type} d-flex align-items-start gap-2 pop-in`} role={type === 'danger' || type === 'warning' ? 'alert' : 'status'}>
      <i className={`bi bi-${ICONS[type] || ICONS.info} mt-1`} aria-hidden="true" />
      <div className="flex-grow-1">
        {sentence(message)}
        {children}
      </div>
      {onClose && <button type="button" className="btn-close" aria-label="Dismiss message" onClick={onClose} />}
    </div>
  );
}
