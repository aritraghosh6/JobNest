import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "./AuthLayout";
import FormAlert from "../../components/FormAlert";
import Loader from "../../components/Loader";
import PasswordInput from "../../components/PasswordInput";
import { getErrorMessage, isEmail, ROLE_LABELS } from "../../utils/helpers";

const ROLE_ICONS = { job_seeker: "person-workspace", employer: "building", admin: "shield-lock" };

// Same toggle as the "Create account" page. Administrators can log in from either tab.
const ROLE_OPTIONS = [
  { value: "job_seeker", icon: "person-workspace", title: "Job seeker" },
  { value: "employer", icon: "building", title: "Employer" },
];
const LAST_ROLE_KEY = "jobnest_last_login_role";

/** The tab used last time on this browser, so people don't have to switch every visit. */
function lastRole() {
  try {
    const saved = localStorage.getItem(LAST_ROLE_KEY);
    return ROLE_OPTIONS.some((o) => o.value === saved) ? saved : "job_seeker";
  } catch {
    return "job_seeker";
  }
}

/** Returns the error for one field, or "" if it is fine. */
function checkField(name, form) {
  if (name === "email") {
    if (!form.email.trim()) return "Please enter your email address.";
    if (!isEmail(form.email)) return "Please enter a valid email address, like name@example.com.";
  }
  if (name === "password" && !form.password) return "Please enter your password.";
  return "";
}

export default function Login() {
  const { user, login, sessionMessage, setSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [loginRole, setLoginRole] = useState(location.state?.role || lastRole);
  // Set when the password is right but belongs to the other account type
  const [suggestRole, setSuggestRole] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Filled when one email has several accounts (e.g. job seeker + employer) and the user must pick one
  const [roleChoices, setRoleChoices] = useState([]);

  if (user) return <Navigate to="/dashboard" replace />;

  // Errors appear as soon as the user leaves a field, and update while they fix it
  const onChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);
    setRoleChoices([]);
    setSuggestRole("");
    if (touched[e.target.name]) setErrors({ ...errors, [e.target.name]: checkField(e.target.name, next) });
  };
  const onBlur = (e) => {
    setTouched({ ...touched, [e.target.name]: true });
    setErrors({ ...errors, [e.target.name]: checkField(e.target.name, form) });
  };

  const chooseRole = (role) => {
    setLoginRole(role);
    setRoleChoices([]);
    setSuggestRole("");
    setError("");
  };

  const doLogin = async (role = loginRole) => {
    setSubmitting(true);
    setError("");
    setSuggestRole("");
    try {
      const me = await login(form.email.trim(), form.password, role);
      try {
        if (me.role !== "admin") localStorage.setItem(LAST_ROLE_KEY, me.role);
      } catch {
        /* storage unavailable: nothing to remember */
      }
      // A saved "from" page is only used when it belongs to the account that was opened
      const from = !role || role === me.role ? location.state?.from : "";
      const destination = from || (me.role === "admin" ? "/admin" : "/dashboard");
      navigate(destination, { replace: true });
    } catch (err) {
      const details = err.response?.data?.details;
      if (err.response?.status === 409 && details?.code === "CHOOSE_ROLE") {
        setRoleChoices(details.roles || []);
      } else if (details?.code === "WRONG_ROLE") {
        setRoleChoices([]);
        setSuggestRole(details.role || "");
        setError(getErrorMessage(err));
      } else {
        setRoleChoices([]);
        setError(err.response?.status === 401 ? "Incorrect email or password." : getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = { email: checkField("email", form), password: checkField("password", form) };
    setErrors(next);
    setTouched({ email: true, password: true });
    if (next.email || next.password) return;
    await doLogin();
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue to your JobNest dashboard.">
      <FormAlert type="warning" message={sessionMessage} onClose={() => setSessionMessage("")} />
      <FormAlert type="success" message={notice} onClose={() => setNotice("")} />
      <FormAlert message={error} onClose={() => setError("")} />
      <form onSubmit={onSubmit} noValidate>
        <fieldset className="mb-3">
          <legend className="visually-hidden">Log in as</legend>
          <div className="btn-group w-100" role="radiogroup">
            {ROLE_OPTIONS.map((opt) => (
              <React.Fragment key={opt.value}>
                <input
                  type="radio"
                  className="btn-check"
                  name="login-role"
                  id={`login-role-${opt.value}`}
                  value={opt.value}
                  checked={loginRole === opt.value}
                  onChange={() => chooseRole(opt.value)}
                />
                <label className="btn btn-outline-primary" htmlFor={`login-role-${opt.value}`}>
                  <i className={`bi bi-${opt.icon} me-2`} aria-hidden="true" />
                  {opt.title}
                </label>
              </React.Fragment>
            ))}
          </div>
        </fieldset>
        {suggestRole && ROLE_LABELS[suggestRole] && (
          <button
            type="button"
            className="btn btn-outline-secondary w-100 mb-3"
            onClick={() => {
              chooseRole(suggestRole);
              doLogin(suggestRole);
            }}
            disabled={submitting}
          >
            <i className={`bi bi-${ROLE_ICONS[suggestRole] || "person"} me-2`} aria-hidden="true" />
            Log in as {ROLE_LABELS[suggestRole]} instead
          </button>
        )}
        <div className="mb-3">
          <label htmlFor="email" className="form-label required">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={`form-control form-control-lg ${errors.email ? "is-invalid" : ""}`}
            value={form.email}
            onChange={onChange}
            onBlur={onBlur}
            aria-invalid={Boolean(errors.email)}
            aria-describedby="email-error"
          />
          <div id="email-error" className="invalid-feedback">{errors.email}</div>
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="form-label required">Password</label>
          <PasswordInput
            name="password"
            large
            autoComplete="current-password"
            value={form.password}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.password}
          />
          {/* Just below the password box, where people look when they can't remember it */}
          <div className="text-end mt-2">
            <Link to="/forgot-password" state={{ role: loginRole, email: form.email.trim() }} className="small fw-semibold forgot-link">Forgot password?</Link>
          </div>
        </div>
        {roleChoices.length > 0 ? (
          <div className="role-choice border rounded-4 p-3" role="group" aria-labelledby="role-choice-title">
            <p id="role-choice-title" className="fw-semibold mb-1">This email has more than one JobNest account.</p>
            <p className="small text-body-secondary mb-3">Which one do you want to open?</p>
            <div className="d-grid gap-2">
              {roleChoices.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="btn btn-outline-primary btn-lg d-flex align-items-center justify-content-center gap-2"
                  onClick={() => doLogin(r)}
                  disabled={submitting}
                >
                  <i className={`bi bi-${ROLE_ICONS[r] || "person"}`} aria-hidden="true" />
                  Continue as {ROLE_LABELS[r] || r}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-link btn-sm w-100 mt-2" onClick={() => setRoleChoices([])}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="submit" className="btn btn-primary btn-lg w-100" disabled={submitting}>
            {submitting && <Loader small />}
            {submitting
              ? "Logging in..."
              : `Log in as ${(ROLE_LABELS[loginRole] || "").toLowerCase() || "user"}`}
          </button>
        )}
      </form>
    </AuthLayout>
  );
}
