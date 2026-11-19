import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../api/services";
import AuthLayout from "./AuthLayout";
import FormAlert from "../../components/FormAlert";
import Loader from "../../components/Loader";
import PasswordInput from "../../components/PasswordInput";
import { getErrorMessage, getFieldErrors, isEmail, ROLE_LABELS } from "../../utils/helpers";

// One email can have a job seeker AND an employer account, each with its own password,
// so the reset is for one of them (same toggle as the login page).
const ROLE_OPTIONS = [
  { value: "job_seeker", icon: "person-workspace", title: "Job seeker" },
  { value: "employer", icon: "building", title: "Employer" },
];

/** Two steps: enter your email -> enter the code and a new password. */
export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(location.state?.email || "");
  const [role, setRole] = useState(
    ROLE_OPTIONS.some((o) => o.value === location.state?.role) ? location.state.role : "job_seeker"
  );
  const [form, setForm] = useState({ otp: "", password: "", confirm: "" });
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (user) return <Navigate to="/dashboard" replace />;

  const sendCode = async (e) => {
    if (e) e.preventDefault();
    if (!isEmail(email)) {
      setErrors({ email: "Please enter a valid email address, like name@example.com." });
      return;
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const res = await authApi.forgotPassword(email.trim(), role);
      setInfo(res);
      setCooldown(res.resend_after || 60);
      setStep("reset");
    } catch (err) {
      const details = getFieldErrors(err);
      if (details.retry_after) setCooldown(details.retry_after);
      setErrors(details);
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const reset = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^\d{6}$/.test(form.otp)) next.otp = "Enter the 6-digit code from your email.";
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      next.password = "Use at least 8 characters with a letter and a number.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const res = await authApi.resetPassword({ email: email.trim(), role, otp: form.otp, password: form.password });
      navigate("/login", { replace: true, state: { notice: res.message, email: email.trim(), role } });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "email") {
    return (
      <AuthLayout title="Forgot your password?" subtitle="Choose the account, enter the email you registered with, and we'll send you a 6-digit code.">
        <FormAlert message={error} onClose={() => setError("")} />
        <form onSubmit={sendCode} noValidate>
          <fieldset className="mb-3">
            <legend className="form-label">Which account's password?</legend>
            <div className="btn-group w-100" role="radiogroup">
              {ROLE_OPTIONS.map((opt) => (
                <React.Fragment key={opt.value}>
                  <input
                    type="radio"
                    className="btn-check"
                    name="reset-role"
                    id={`reset-role-${opt.value}`}
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => {
                      setRole(opt.value);
                      setErrors({});
                      setError("");
                    }}
                  />
                  <label className="btn btn-outline-primary" htmlFor={`reset-role-${opt.value}`}>
                    <i className={`bi bi-${opt.icon} me-2`} aria-hidden="true" />
                    {opt.title}
                  </label>
                </React.Fragment>
              ))}
            </div>
            <div className="form-text">Only this account's password changes. If you also have the other account on this email, it keeps its own password.</div>
          </fieldset>
          <label htmlFor="email" className="form-label required">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`form-control form-control-lg ${errors.email ? "is-invalid" : ""}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors({});
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-error"
            autoFocus
          />
          <div id="email-error" className="invalid-feedback">{errors.email}</div>
          <button type="submit" className="btn btn-primary btn-lg w-100 mt-4" disabled={busy}>
            {busy && <Loader small />}
            {busy ? "Sending code…" : "Send reset code"}
          </button>
        </form>
        <p className="text-center mt-3 mb-0">
          <Link to="/login" className="small"><i className="bi bi-arrow-left me-1" aria-hidden="true" />Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Choose a new ${(ROLE_LABELS[role] || "").toLowerCase()} password`} subtitle={info?.message}>
      <FormAlert message={error} onClose={() => setError("")} />
      {info && !info.email_configured && (
        <FormAlert type="info" message="Email sending is not set up on the server yet, so the code was printed in the backend terminal." />
      )}
      <form onSubmit={reset} noValidate>
        <label htmlFor="otp" className="form-label required">Code from your email</label>
        <input
          id="otp"
          className={`form-control form-control-lg text-center fw-bold otp-input ${errors.otp ? "is-invalid" : ""}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          value={form.otp}
          onChange={(e) => set("otp", e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={Boolean(errors.otp)}
          aria-describedby="otp-error"
          autoFocus
        />
        <div id="otp-error" className="invalid-feedback">{errors.otp}</div>

        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label htmlFor="password" className="form-label required">New password</label>
            <PasswordInput name="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />
          </div>
          <div className="col-md-6">
            <label htmlFor="confirm" className="form-label required">Confirm new password</label>
            <PasswordInput name="confirm" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} error={errors.confirm} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg w-100 mt-4" disabled={busy}>
          {busy && <Loader small />}
          {busy ? "Saving…" : "Reset password"}
        </button>
      </form>
      <div className="d-flex justify-content-between mt-3 small">
        <button type="button" className="btn btn-link p-0" onClick={() => setStep("email")}>
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />Use a different email
        </button>
        <button type="button" className="btn btn-link p-0" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </AuthLayout>
  );
}
