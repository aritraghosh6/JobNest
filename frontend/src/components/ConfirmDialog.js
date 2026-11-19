import React, { useEffect, useRef } from "react";

/**
 * Accessible confirmation dialog, used instead of the browser's window.confirm.
 *
 * <ConfirmDialog open title="Withdraw application?" message="..." confirmText="Withdraw"
 *   tone="danger" onConfirm={...} onCancel={...}>optional extra content</ConfirmDialog>
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  children,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("dialog-open");
      previous?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="jn-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel?.()}>
      <div className="jn-dialog" role="dialog" aria-modal="true" aria-labelledby="jn-dialog-title" aria-describedby="jn-dialog-message">
        <div className={`jn-dialog-icon text-${tone}`} aria-hidden="true">
          <i className={`bi bi-${tone === "danger" ? "exclamation-octagon" : tone === "warning" ? "exclamation-triangle" : "question-circle"}`} />
        </div>
        <h2 id="jn-dialog-title" className="h5 fw-bold mb-2">{title}</h2>
        {message && <p id="jn-dialog-message" className="text-muted mb-3">{message}</p>}
        {children}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-light" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button ref={confirmRef} type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App-wide confirm():  const confirm = useConfirm();                   */
/*   if (!(await confirm({ title, message, confirmText, tone }))) return; */
/* ------------------------------------------------------------------ */
const ConfirmContext = React.createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null);
  const confirm = React.useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    []
  );
  const close = (answer) => {
    state?.resolve(answer);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(state)}
        title={state?.title}
        message={state?.message}
        confirmText={state?.confirmText}
        cancelText={state?.cancelText}
        tone={state?.tone}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** Returns confirm(options) -> Promise<boolean>. Falls back to the browser dialog outside the provider. */
export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  return ctx || ((o) => Promise.resolve(window.confirm(o.message || o.title)));
}
