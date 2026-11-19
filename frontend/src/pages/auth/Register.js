import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../api/services";
import AuthLayout from "./AuthLayout";
import FormAlert from "../../components/FormAlert";
import Loader from "../../components/Loader";
import PasswordInput from "../../components/PasswordInput";
import { getErrorMessage, getFieldErrors, isEmail } from "../../utils/helpers";

const ROLE_OPTIONS = [
  { value: "job_seeker", icon: "person-workspace", title: "Job seeker" },
  { value: "employer", icon: "building", title: "Employer" },
];

/** Returns the error for one field, or "" if it is fine. */
function checkField(name, form) {
  switch (name) {
    case "name":
      return form.name.trim() ? "" : "Please enter your name.";
    case "email":
      if (!form.email.trim()) return "Please enter your email address.";
      return isEmail(form.email) ? "" : "Please enter a valid email address, like name@example.com.";
    case "password":
      if (!form.password) return "Please choose a password.";
      if (form.password.length < 8) return "Use at least 8 characters.";
      if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) return "Include at least one letter and one number.";
      return "";
    case "confirm":
      if (!form.confirm) return "Please type your password again.";
      return form.confirm === form.password ? "" : "Passwords do not match.";
    default:
      return "";
  }
}
const FIELDS = ["name", "email", "password", "confirm"];

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  const levels = [
    { label: "Too short", color: "#dc2626" },
    { label: "Weak", color: "#dc2626" },
    { label: "Fair", color: "#d97706" },
    { label: "Good", color: "#0f766e" },
    { label: "Strong", color: "#047857" },
  ];
  return { score, ...levels[score] };
}

/**
 * Two steps on one screen:
 *   1. "details": role, name, email, password  -> backend emails a 6-digit code
 *   2. "verify":  enter the code               -> backend creates the account
 */
export default function Register() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialRole = params.get("role") === "employer" ? "employer" : "job_seeker";
  const [form, setForm] = useState({ role: initialRole, name: "", email: "", password: "", confirm: "" });
  const [step, setStep] = useState("details");
  const [otp, setOtp] = useState("");
  const [otpInfo, setOtpInfo] = useState(null); // response from send-otp
  const [cooldown, setCooldown] = useState(0); // seconds until "Resend" is allowed
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Counts the resend timer down once per second
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (user) return <Navigate to="/dashboard" replace />;

  const strength = passwordStrength(form.password);
  const isEmployer = form.role === "employer";

  // Errors appear as soon as the user leaves a field, and update while they fix it
  const onChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (name === "role") return;
    const updated = { ...errors };
    if (touched[name]) updated[name] = checkField(name, next);
    // Changing the password re-checks "Confirm password" too
    if (name === "password" && touched.confirm) updated.confirm = checkField("confirm", next);
    setErrors(updated);
  };

  const onBlur = (e) => {
    const { name } = e.target;
    setTouched({ ...touched, [name]: true });
    setErrors({ ...errors, [name]: checkField(name, form) });
  };

  const validate = () => {
    const next = {};
    FIELDS.forEach((f) => {
      const msg = checkField(f, form);
      if (msg) next[f] = msg;
    });
    setErrors(next);
    setTouched({ name: true, email: true, password: true, confirm: true });
    return Object.keys(next).length === 0;
  };

  const payload = () => ({
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    role: form.role,
  });

  // Step 1 (and "Resend code")
  const sendCode = async (e) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await authApi.sendSignupOtp(payload());
      setOtpInfo(res);
      setCooldown(res.resend_after || 60);
      setOtp("");
      setStep("verify");
    } catch (err) {
      const details = getFieldErrors(err);
      if (details.retry_after) {
        setCooldown(details.retry_after);
        if (step === "details" && otpInfo) setStep("verify");
      }
      setErrors(details);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2
  const verify = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: "Enter the 6-digit code from your email." });
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signup({ ...payload(), otp });
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const backToDetails = () => {
    setStep("details");
    setError("");
    setErrors({});
  };

  const field = (name, label, type = "text", autoComplete) => (
    <div className="col-md-6">
      <label htmlFor={name} className="form-label required mb-1">{label}</label>
      {type === "password" ? (
        <PasswordInput
          name={name}
          autoComplete={autoComplete}
          value={form[name]}
          onChange={onChange}
          onBlur={onBlur}
          error={errors[name]}
        />
      ) : (
        <>
          <input
            id={name}
            name={name}
            type={type}
            autoComplete={autoComplete}
            className={`form-control ${errors[name] ? "is-invalid" : ""}`}
            value={form[name]}
            onChange={onChange}
            onBlur={onBlur}
            aria-invalid={Boolean(errors[name])}
            aria-describedby={`${name}-error`}
          />
          <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>
        </>
      )}
    </div>
  );

  if (step === "verify") {
    return (
      <AuthLayout title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${otpInfo?.email || form.email}.`}>
        <FormAlert message={error} onClose={() => setError("")} />
        {otpInfo?.delivery === "logged" && (
          <FormAlert
            type="info"
            message="Email sending is not set up on the server yet, so the code was printed in the backend terminal."
          />
        )}
        {isEmployer && otpInfo?.email_type === "personal" && (
          <FormAlert
            type="warning"
            message="You are using a personal email address. That's fine, but before you can post jobs an administrator will check the company document you upload on your company profile."
          />
        )}
        <form onSubmit={verify} noValidate>
          <label htmlFor="otp" className="form-label required mb-1">Verification code</label>
          <input
            id="otp"
            name="otp"
            className={`form-control form-control-lg text-center fw-bold ${errors.otp ? "is-invalid" : ""}`}
            style={{ letterSpacing: "0.5em" }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              setErrors({});
            }}
            aria-invalid={Boolean(errors.otp)}
            aria-describedby="otp-error"
            autoFocus
          />
          <div id="otp-error" className="invalid-feedback">{errors.otp}</div>

          <button type="submit" className="btn btn-primary btn-lg w-100 mt-3" disabled={submitting}>
            {submitting && <Loader small />}
            {submitting ? "Verifying…" : `Verify & create ${isEmployer ? "employer" : "job seeker"} account`}
          </button>
        </form>
        <div className="d-flex justify-content-between align-items-center mt-3 small">
          <button type="button" className="btn btn-link p-0" onClick={backToDetails}>
            <i className="bi bi-arrow-left me-1" aria-hidden="true" />Change details
          </button>
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={() => sendCode()}
            disabled={cooldown > 0 || submitting}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      <FormAlert message={error} onClose={() => setError("")} />
      <form onSubmit={sendCode} noValidate>
        <fieldset className="mb-3">
          <legend className="visually-hidden">I am a…</legend>
          <div className="btn-group w-100" role="radiogroup">
            {ROLE_OPTIONS.map((opt) => (
              <React.Fragment key={opt.value}>
                <input
                  type="radio"
                  className="btn-check"
                  name="role"
                  id={`role-${opt.value}`}
                  value={opt.value}
                  checked={form.role === opt.value}
                  onChange={onChange}
                />
                <label className="btn btn-outline-primary" htmlFor={`role-${opt.value}`}>
                  <i className={`bi bi-${opt.icon} me-2`} aria-hidden="true" />
                  {opt.title}
                </label>
              </React.Fragment>
            ))}
          </div>
        </fieldset>

        <div className="row g-3">
          {field("name", isEmployer ? "Your name (company contact)" : "Full name", "text", "name")}
          {field("email", isEmployer ? "Work email" : "Email", "email", "email")}
          {field("password", "Password", "password", "new-password")}
          {field("confirm", "Confirm password", "password", "new-password")}
        </div>

        <div className="mt-2" style={{ minHeight: 22 }} aria-live="polite">
          {form.password && (
            <div className="d-flex align-items-center gap-2">
              <div className="password-meter flex-grow-1" aria-hidden="true">
                <span style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} />
              </div>
              <span className="small" style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-lg w-100 mt-2" disabled={submitting}>
          {submitting && <Loader small />}
          {submitting ? "Sending code…" : "Send verification code"}
        </button>
      </form>
    </AuthLayout>
  );
}
