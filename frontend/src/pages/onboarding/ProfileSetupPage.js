import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { profileApi } from "../../api/services";
import FormAlert from "../../components/FormAlert";
import Loader from "../../components/Loader";
import TagInput from "../../components/TagInput";
import CompanyFinder from "../../components/CompanyFinder";
import { COMPANY_SIZES, CULTURE_TAGS, EMPLOYMENT_TYPES, ROLES, getErrorCode, getErrorMessage, getFieldErrors, isUrl } from "../../utils/helpers";

/* ------------------------------------------------------------------ */
/*  Question lists. Each question has a number, a label and 1+ fields. */
/* ------------------------------------------------------------------ */

const THIS_YEAR = new Date().getFullYear();
const PHONE_RE = /^[+]?[\d\s-]{7,15}$/;
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");

const CAREER_STATUS = [
  { value: "student", label: "Student" },
  { value: "fresher", label: "Fresher" },
  { value: "working", label: "Working" },
  { value: "career_break", label: "Career break" },
];
const NOTICE = [
  { value: "immediate", label: "Immediately" },
  { value: "15_days", label: "15 days" },
  { value: "30_days", label: "30 days" },
  { value: "60_days", label: "60 days" },
  { value: "90_days", label: "90 days" },
];
const EXP_TYPES = [
  { value: "job", label: "Job" },
  { value: "internship", label: "Internship" },
  { value: "project", label: "Project" },
];
const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const urlCheck = (keys) => (f) =>
  Object.fromEntries(keys.filter((k) => filled(f[k]) && !isUrl(f[k])).map((k) => [k, "Enter a full link starting with https://"]));

const SEEKER_STEPS = [
  {
    title: "About you",
    questions: [
      { n: 1, label: "What is your full name?", fields: [{ key: "full_name", type: "text", required: true, autoComplete: "name" }] },
      {
        n: 2,
        label: "What is your phone number?",
        fields: [{ key: "phone", type: "tel", placeholder: "+91 98765 43210", autoComplete: "tel" }],
        validate: (f) => (filled(f.phone) && !PHONE_RE.test(f.phone) ? { phone: "Enter a valid phone number (7-15 digits)." } : {}),
      },
      { n: 3, label: "Which city do you live in?", fields: [{ key: "location", type: "text", required: true, placeholder: "e.g. Pune" }] },
      { n: 4, label: "What best describes you right now?", fields: [{ key: "current_status", type: "single", options: CAREER_STATUS }] },
      {
        n: 5,
        label: "How many years of work experience do you have?",
        fields: [{ key: "experience_years", type: "number", placeholder: "0 if you are a student or fresher" }],
        validate: (f) =>
          filled(f.experience_years) && !(Number(f.experience_years) >= 0 && Number(f.experience_years) <= 50)
            ? { experience_years: "Enter a number between 0 and 50." }
            : {},
      },
    ],
  },
  {
    title: "Your story",
    questions: [
      {
        n: 6,
        label: "Write a one-line headline about yourself.",
        fields: [{ key: "headline", type: "text", placeholder: "e.g. Electrical engineer | SCADA & power systems", max: 120 }],
      },
      {
        n: 7,
        label: "Tell employers a little about yourself.",
        fields: [{ key: "summary", type: "textarea", placeholder: "Your strengths, interests and what you are looking for.", max: 1500 }],
      },
    ],
  },
  {
    title: "Education",
    questions: [
      { n: 8, label: "What is your highest degree?", fields: [{ key: "degree", type: "text", placeholder: "e.g. B.Tech" }] },
      { n: 9, label: "Which college or university?", fields: [{ key: "institution", type: "text" }] },
      { n: 10, label: "What was your field of study?", fields: [{ key: "field_of_study", type: "text", placeholder: "e.g. Electrical Engineering" }] },
      {
        n: 11,
        label: "When did (or will) you graduate?",
        fields: [{ key: "graduation_year", type: "number", placeholder: `e.g. ${THIS_YEAR}` }],
        validate: (f) =>
          filled(f.graduation_year) && !(Number(f.graduation_year) >= 1950 && Number(f.graduation_year) <= THIS_YEAR + 8)
            ? { graduation_year: `Enter a year between 1950 and ${THIS_YEAR + 8}.` }
            : {},
      },
    ],
    // Degree and college must be given together, because the profile stores them as one entry
    validate: (f) => {
      const any = ["degree", "institution", "field_of_study", "graduation_year"].some((k) => filled(f[k]));
      const e = {};
      if (any && !filled(f.degree)) e.degree = "Please add your degree, or clear the other education answers.";
      if (any && !filled(f.institution)) e.institution = "Please add your college, or clear the other education answers.";
      return e;
    },
  },
  {
    title: "Skills & experience",
    questions: [
      {
        n: 12,
        label: "What are your top skills?",
        fields: [{ key: "skills", type: "tags", required: true, help: "Type a skill and press Enter. Add as many as you like." }],
      },
      {
        n: 13,
        label: "Tell us about your most recent job, internship or project.",
        help: "Optional. You can add more later on your Profile page.",
        fields: [
          { key: "exp_type", label: "Type", type: "single", options: EXP_TYPES },
          { key: "exp_title", label: "Title / role", type: "text", placeholder: "e.g. Graduate Engineer Trainee" },
          { key: "exp_org", label: "Company / organisation", type: "text" },
          { key: "exp_description", label: "What did you do?", type: "textarea", max: 1000 },
        ],
        validate: (f) => {
          const any = ["exp_title", "exp_org", "exp_description"].some((k) => filled(f[k]));
          const e = {};
          if (any && !filled(f.exp_title)) e.exp_title = "Please add a title, or clear this question.";
          if (any && !filled(f.exp_org)) e.exp_org = "Please add the organisation, or clear this question.";
          return e;
        },
      },
    ],
  },
  {
    title: "What you are looking for",
    questions: [
      {
        n: 14,
        label: "Which roles are you looking for?",
        fields: [{ key: "desired_roles", type: "tags", required: true, help: "e.g. Electrical Engineer, Data Analyst. Press Enter after each." }],
      },
      { n: 15, label: "Which job types suit you?", fields: [{ key: "job_types", type: "multi", options: EMPLOYMENT_TYPES, required: true }] },
      { n: 16, label: "Which cities would you like to work in?", fields: [{ key: "preferred_locations", type: "tags" }] },
      { n: 17, label: "Are you open to remote work?", fields: [{ key: "open_to_remote", type: "single", options: YES_NO }] },
      {
        n: 18,
        label: "What annual salary do you expect (\u20B9)?",
        fields: [{ key: "expected_salary", type: "number", placeholder: "e.g. 600000" }],
        validate: (f) => (filled(f.expected_salary) && !(Number(f.expected_salary) >= 0) ? { expected_salary: "Enter a valid amount." } : {}),
      },
      { n: 19, label: "How soon can you join?", fields: [{ key: "notice_period", type: "single", options: NOTICE }] },
    ],
  },
  {
    title: "Links & resume",
    questions: [
      {
        n: 20,
        label: "Where can employers see your work?",
        help: "Optional. Use full links starting with https://",
        fields: [
          { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/..." },
          { key: "github", label: "GitHub", type: "url", placeholder: "https://github.com/..." },
          { key: "portfolio", label: "Portfolio / website", type: "url", placeholder: "https://..." },
        ],
        validate: urlCheck(["linkedin", "github", "portfolio"]),
      },
      {
        n: 21,
        label: "Upload your resume.",
        help: "PDF or Word (.docx). Optional now, but employers see it when you apply.",
        fields: [{ key: "resume", type: "file", accept: ".pdf,.docx" }],
      },
    ],
  },
];

const EMPLOYER_STEPS = [
  {
    title: "Company basics",
    questions: [
      { n: 1, label: "What is your company's name?", fields: [{ key: "company_name", type: "text", required: true, autoComplete: "organization" }] },
      { n: 2, label: "Which industry are you in?", fields: [{ key: "industry", type: "text", required: true, placeholder: "e.g. Renewable energy" }] },
      { n: 3, label: "Where is your head office?", fields: [{ key: "location", type: "text", required: true, placeholder: "e.g. Bengaluru" }] },
      {
        n: 4,
        label: "Company website",
        help: "Optional. Startups without a website can leave this empty.",
        fields: [{ key: "website", type: "url", placeholder: "https://..." }],
        validate: urlCheck(["website"]),
      },
      { n: 5, label: "How many people work at the company?", fields: [{ key: "company_size", type: "single", options: COMPANY_SIZES.map((s) => ({ value: s, label: s })) }] },
      {
        n: 6,
        label: "When was the company founded?",
        fields: [{ key: "founded_year", type: "number", placeholder: `e.g. ${THIS_YEAR - 1}` }],
        validate: (f) =>
          filled(f.founded_year) && !(Number(f.founded_year) >= 1800 && Number(f.founded_year) <= THIS_YEAR)
            ? { founded_year: `Enter a year between 1800 and ${THIS_YEAR}.` }
            : {},
      },
    ],
  },
  {
    title: "About & contact",
    questions: [
      {
        n: 7,
        label: "Describe your company.",
        fields: [{ key: "company_description", type: "textarea", required: true, max: 2000, placeholder: "What you do, who you serve, and what makes you different." }],
        validate: (f) =>
          filled(f.company_description) && f.company_description.trim().length < 30
            ? { company_description: "Please write at least 30 characters." }
            : {},
      },
      { n: 8, label: "What is your role at the company?", fields: [{ key: "contact_designation", type: "text", placeholder: "e.g. Founder, HR Manager" }] },
      {
        n: 9,
        label: "Contact phone number",
        fields: [{ key: "contact_phone", type: "tel", placeholder: "+91 98765 43210", autoComplete: "tel" }],
        validate: (f) => (filled(f.contact_phone) && !PHONE_RE.test(f.contact_phone) ? { contact_phone: "Enter a valid phone number (7-15 digits)." } : {}),
      },
    ],
  },
  {
    title: "Culture & hiring",
    questions: [
      { n: 10, label: "How would you describe your work culture?", fields: [{ key: "culture_description", type: "textarea", max: 2000 }] },
      { n: 11, label: "What are your company values?", fields: [{ key: "values", type: "tags", help: "e.g. Safety, Ownership. Press Enter after each." }] },
      {
        n: 12,
        label: "Which words fit your culture best?",
        help: "Used to match candidates whose work style fits.",
        fields: [{ key: "culture_tags", type: "multi", options: CULTURE_TAGS }],
      },
      { n: 13, label: "Which skills do you usually hire for?", fields: [{ key: "required_skills", type: "tags", required: true }] },
      { n: 14, label: "What salary range do you typically offer?", fields: [{ key: "salary_range", type: "text", placeholder: "e.g. \u20B94-8 LPA" }] },
    ],
  },
  {
    title: "Logo & verification",
    questions: [
      {
        n: 15,
        label: "Company logo and verification documents",
        help:
          "You can post jobs once an administrator verifies your company. Upload a registration certificate (CIN, GST, Udyam or similar). This is especially important if you signed up with a personal email like Gmail.",
        fields: [
          { key: "logo", label: "Logo (PNG, JPG or WEBP)", type: "file", accept: ".png,.jpg,.jpeg,.webp" },
          { key: "registration_number", label: "Registration number", type: "text", placeholder: "CIN / GSTIN / Udyam number" },
          { key: "verification_document", label: "Registration document (PDF, PNG or JPG)", type: "file", accept: ".pdf,.png,.jpg,.jpeg" },
        ],
        validate: (f, files) => {
          const e = {};
          const reg = filled(f.registration_number);
          const doc = Boolean(files.verification_document);
          if (reg && !/^[A-Za-z0-9\-/ ]{5,50}$/.test(f.registration_number)) e.registration_number = "Use 5-50 letters or digits.";
          if (reg && !doc) e.verification_document = "Please attach the document for this registration number.";
          if (doc && !reg) e.registration_number = "Please enter the registration number on the document.";
          return e;
        },
      },
    ],
  },
];

const FILE_KEYS = ["resume", "logo", "verification_document"];

/* ---------- Converting between the form and the saved profile ---------- */

function seekerForm(profile, user) {
  const edu = profile?.education?.[0] || {};
  const exp = profile?.experience?.[0] || {};
  const prefs = profile?.job_preferences || {};
  const social = profile?.social_links || {};
  return {
    full_name: profile?.full_name || user?.name || "",
    phone: profile?.phone || "",
    location: profile?.location || "",
    current_status: profile?.current_status || "",
    experience_years: profile?.experience_years ?? "",
    headline: profile?.headline || "",
    summary: profile?.summary || "",
    degree: edu.degree || "",
    institution: edu.institution || "",
    field_of_study: edu.field_of_study || "",
    graduation_year: edu.end_year ?? "",
    skills: profile?.skills || [],
    exp_type: exp.type || "job",
    exp_title: exp.title || "",
    exp_org: exp.organization || "",
    exp_description: exp.description || "",
    desired_roles: prefs.desired_roles || [],
    job_types: prefs.job_types || [],
    preferred_locations: prefs.preferred_locations || [],
    open_to_remote: profile ? (prefs.open_to_remote ? "yes" : "no") : "",
    expected_salary: prefs.expected_salary ?? "",
    notice_period: profile?.notice_period || "",
    linkedin: social.linkedin || "",
    github: social.github || "",
    portfolio: social.portfolio || "",
  };
}

function seekerPayload(f, profile) {
  const edu = filled(f.degree)
    ? [{ degree: f.degree, institution: f.institution, field_of_study: f.field_of_study, end_year: f.graduation_year || undefined, start_year: profile?.education?.[0]?.start_year, grade: profile?.education?.[0]?.grade }]
    : [];
  const exp = filled(f.exp_title)
    ? [{ ...(profile?.experience?.[0] || {}), type: f.exp_type || "job", title: f.exp_title, organization: f.exp_org, description: f.exp_description }]
    : [];
  return {
    full_name: f.full_name,
    phone: f.phone,
    location: f.location,
    current_status: f.current_status,
    experience_years: f.experience_years === "" ? undefined : f.experience_years,
    notice_period: f.notice_period,
    headline: f.headline,
    summary: f.summary,
    skills: f.skills,
    // Keep any extra entries added on the Profile page
    education: [...edu, ...(profile?.education || []).slice(1)],
    experience: [...exp, ...(profile?.experience || []).slice(1)],
    job_preferences: {
      desired_roles: f.desired_roles,
      job_types: f.job_types,
      preferred_locations: f.preferred_locations,
      open_to_remote: f.open_to_remote === "yes",
      expected_salary: f.expected_salary === "" ? undefined : f.expected_salary,
    },
    social_links: { linkedin: f.linkedin, github: f.github, portfolio: f.portfolio },
  };
}

function employerForm(profile) {
  const prefs = profile?.job_preferences || {};
  return {
    company_name: profile?.company_name || "",
    industry: profile?.industry || "",
    location: profile?.location || "",
    website: profile?.website || "",
    company_size: profile?.company_size || "",
    founded_year: profile?.founded_year ?? "",
    company_description: profile?.company_description || "",
    contact_designation: profile?.contact_designation || "",
    contact_phone: profile?.contact_phone || "",
    culture_description: profile?.culture_description || "",
    values: profile?.values || [],
    culture_tags: profile?.culture_tags || [],
    required_skills: prefs.required_skills || [],
    salary_range: prefs.salary_range || "",
    registration_number: "",
  };
}

function employerPayload(f) {
  return {
    company_name: f.company_name,
    industry: f.industry,
    location: f.location,
    website: f.website,
    company_size: f.company_size || undefined,
    founded_year: f.founded_year === "" ? undefined : f.founded_year,
    company_description: f.company_description,
    contact_designation: f.contact_designation,
    contact_phone: f.contact_phone,
    culture_description: f.culture_description,
    values: f.values,
    culture_tags: f.culture_tags,
    job_preferences: { required_skills: f.required_skills, salary_range: f.salary_range },
  };
}

/* ---------- Draft: unfinished answers survive a refresh or "Finish later" ---------- */

const draftKey = (user) => `jobnest_profile_setup_${user?.id}`;
function readDraft(user) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(user)) || "null");
  } catch {
    return null;
  }
}
function writeDraft(user, value) {
  try {
    if (value) localStorage.setItem(draftKey(user), JSON.stringify(value));
    else localStorage.removeItem(draftKey(user));
  } catch {
    /* storage unavailable: answers are kept only while the page is open */
  }
}

/* ------------------------------------------------------------------ */

export default function ProfileSetupPage() {
  const { user, patchUser } = useAuth();
  const navigate = useNavigate();
  const isSeeker = user.role === ROLES.JOB_SEEKER;
  const steps = isSeeker ? SEEKER_STEPS : EMPLOYER_STEPS;
  const total = steps.reduce((sum, s) => sum + s.questions.length, 0);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);
  // Employers: first check whether the company is already registered ("find"), or create a new one ("create")
  const [companyStep, setCompanyStep] = useState("find");
  const [finderQuery, setFinderQuery] = useState("");
  const headingRef = useRef(null);

  // Load the saved profile (if any), then any unfinished draft on top of it
  useEffect(() => {
    let active = true;
    profileApi
      .getMine()
      .then((res) => res.profile)
      .catch(() => null)
      .then((saved) => {
        if (!active) return;
        const base = isSeeker ? seekerForm(saved, user) : employerForm(saved);
        const draft = readDraft(user);
        setProfile(saved);
        setForm(draft?.form ? { ...base, ...draft.form } : base);
        setStep(draft?.step && draft.step < steps.length ? draft.step : 0);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form) writeDraft(user, { form, step });
  }, [form, step, user]);

  // Move keyboard and screen-reader focus to the new step's heading
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const current = steps[step];
  const answeredBefore = useMemo(() => steps.slice(0, step).reduce((s, x) => s + x.questions.length, 0), [steps, step]);
  const verificationLocked = !isSeeker && ["pending", "approved"].includes(profile?.verification?.status);

  if (!form) return <Loader text="Loading your profile..." />;

  // New employer: join an existing company, or carry on to create a new one
  if (!isSeeker && !profile && companyStep === "find") {
    return (
      <div className="container py-4" style={{ maxWidth: 860 }}>
        <h1 className="h3 fw-bold mb-1">Set up your company</h1>
        <p className="text-muted mb-4">Join your company if it's already on JobNest, or create its page.</p>
        <FormAlert message={error} onClose={() => setError("")} />
        <CompanyFinder
          key={finderQuery}
          initialQuery={finderQuery}
          onJoined={(res) => {
            writeDraft(user, null);
            patchUser({ profile_completed: true });
            navigate("/dashboard", { replace: true, state: { message: res.message } });
          }}
          onCreateNew={() => {
            setError("");
            setCompanyStep("create");
          }}
        />
        <div className="text-center mt-3">
          <button type="button" className="btn btn-link" onClick={() => navigate("/dashboard")}>I'll do this later</button>
        </div>
      </div>
    );
  }

  const setValue = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setFile = (key, file) => {
    setFiles((f) => ({ ...f, [key]: file || undefined }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validateStep = (index) => {
    const s = steps[index];
    let next = {};
    s.questions.forEach((q) => {
      q.fields.forEach((fd) => {
        if (fd.required && !filled(form[fd.key])) next[fd.key] = "This question is required.";
        if (fd.max && filled(form[fd.key]) && String(form[fd.key]).length > fd.max) next[fd.key] = `Please keep this under ${fd.max} characters.`;
      });
      if (q.validate) next = { ...q.validate(form, files), ...next };
    });
    if (s.validate) next = { ...s.validate(form, files), ...next };
    if (verificationLocked) {
      delete next.registration_number;
      delete next.verification_document;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setError("");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setErrors({});
    setError("");
    setStep((s) => s - 1);
    window.scrollTo({ top: 0 });
  };

  const save = async () => {
    for (let i = 0; i < steps.length; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const body = isSeeker ? seekerPayload(form, profile) : employerPayload(form);
      const res = profile ? await profileApi.update(body) : await profileApi.create(body);
      setProfile(res.profile);
      patchUser({ profile_completed: true });

      // Files are uploaded after the profile exists. A failed upload does not undo the profile.
      const problems = [];
      const tryUpload = async (label, fn) => {
        try {
          await fn();
        } catch (err) {
          problems.push(`${label}: ${getErrorMessage(err)}`);
        }
      };
      if (files.resume) await tryUpload("Resume", () => profileApi.uploadDocument("resume", files.resume));
      if (files.logo) await tryUpload("Logo", () => profileApi.uploadLogo(files.logo));
      if (!verificationLocked && files.verification_document && filled(form.registration_number)) {
        await tryUpload("Verification", () => profileApi.submitVerification(form.registration_number.trim(), files.verification_document));
      }

      writeDraft(user, null);
      if (problems.length) {
        setWarning(`Your profile was saved, but some uploads failed. You can retry them from your ${isSeeker ? "Profile" : "Company"} page. ${problems.join(" ")}`);
        setSaving(false);
        return;
      }
      navigate("/dashboard", { replace: true, state: { message: "Your profile is ready." } });
    } catch (err) {
      if (!isSeeker && !profile && getErrorCode(err) === "COMPANY_EXISTS") {
        setFinderQuery(form.company_name || "");
        setCompanyStep("find");
        setError(getErrorMessage(err));
        setSaving(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const details = getFieldErrors(err);
      setErrors(details);
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const finishLater = () => navigate("/dashboard");

  /* ---------- Rendering one field ---------- */
  const renderField = (fd, q, single) => {
    const id = `f-${fd.key}`;
    const err = errors[fd.key];
    const label = single ? null : (
      <label htmlFor={id} className={`form-label small mb-1 ${fd.required ? "required" : ""}`}>{fd.label}</label>
    );
    const describedBy = `${id}-error`;
    const errorEl = <div id={describedBy} className="invalid-feedback d-block">{err}</div>;

    if (fd.type === "tags") {
      return (
        <div key={fd.key}>
          <TagInput id={id} value={form[fd.key]} onChange={(v) => setValue(fd.key, v)} error={err} help={fd.help} />
        </div>
      );
    }
    if (fd.type === "single" || fd.type === "multi") {
      const multi = fd.type === "multi";
      const value = form[fd.key];
      const toggle = (v) => {
        if (multi) setValue(fd.key, value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
        else setValue(fd.key, value === v ? "" : v);
      };
      return (
        <div key={fd.key} className="mb-3">
          {label}
          <div className="d-flex flex-wrap gap-2" role="group" aria-label={fd.label || q.label} aria-describedby={describedBy}>
            {fd.options.map((opt) => {
              const active = multi ? value.includes(opt.value) : value === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  className={`choice-chip ${active ? "active" : ""}`}
                  aria-pressed={active}
                  title={opt.hint}
                  onClick={() => toggle(opt.value)}
                >
                  {active && <i className="bi bi-check2 me-1" aria-hidden="true" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errorEl}
        </div>
      );
    }
    if (fd.type === "file") {
      const disabled = verificationLocked && fd.key === "verification_document";
      return (
        <div key={fd.key} className="mb-3">
          {label}
          <input
            id={id}
            type="file"
            accept={fd.accept}
            disabled={disabled}
            className={`form-control ${err ? "is-invalid" : ""}`}
            onChange={(e) => setFile(fd.key, e.target.files[0])}
            aria-describedby={describedBy}
          />
          {files[fd.key] && <div className="small text-muted mt-1">Selected: {files[fd.key].name}</div>}
          {errorEl}
        </div>
      );
    }
    const common = {
      id,
      name: fd.key,
      value: form[fd.key],
      placeholder: fd.placeholder,
      autoComplete: fd.autoComplete,
      onChange: (e) => setValue(fd.key, e.target.value),
      className: `form-control ${err ? "is-invalid" : ""}`,
      "aria-invalid": Boolean(err),
      "aria-describedby": describedBy,
      disabled: verificationLocked && fd.key === "registration_number",
    };
    return (
      <div key={fd.key} className="mb-3">
        {label}
        {fd.type === "textarea" ? (
          <textarea {...common} rows={4} />
        ) : (
          <input {...common} type={fd.type === "url" ? "url" : fd.type === "tel" ? "tel" : fd.type === "number" ? "number" : "text"} min={fd.type === "number" ? 0 : undefined} />
        )}
        {fd.max && <div className="form-text">{String(form[fd.key] || "").length}/{fd.max} characters</div>}
        {errorEl}
      </div>
    );
  };

  const isLast = step === steps.length - 1;
  const shownUpTo = answeredBefore + current.questions.length;

  return (
    <div className="container py-4" style={{ maxWidth: 760 }}>
      <div className="d-flex justify-content-between align-items-center mb-2 small text-muted">
        <span>Step {step + 1} of {steps.length}</span>
        <span>Questions {answeredBefore + 1}-{shownUpTo} of {total}</span>
      </div>
      <div className="wizard-progress mb-4" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label="Profile setup progress">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <h1 className="h3 fw-bold mb-1" tabIndex={-1} ref={headingRef}>{current.title}</h1>
      <p className="text-muted mb-4">
        {isSeeker ? "Set up your profile so we can match you with the right jobs." : "Set up your company profile so candidates can find you."} Questions marked * are required.
      </p>

      <FormAlert message={error} onClose={() => setError("")} />
      <FormAlert type="warning" message={warning} />
      {verificationLocked && isLast && (
        <FormAlert type="info" message={`Your company verification is ${profile.verification.status === "approved" ? "approved" : "under review"}, so the document fields are locked.`} />
      )}

      <div className="jn-card p-4 mb-4">
        {current.questions.map((q) => {
          const single = q.fields.length === 1;
          const required = q.fields.some((fd) => fd.required);
          return (
            <fieldset key={q.n} className="mb-4">
              <legend className={`wizard-q fs-6 mb-2 ${required ? "required" : ""}`}>
                <span className="q-num">{q.n}.</span>
                {single && q.fields[0].type !== "single" && q.fields[0].type !== "multi" ? (
                  <label htmlFor={`f-${q.fields[0].key}`} className="d-inline">{q.label}</label>
                ) : (
                  q.label
                )}
              </legend>
              {q.help && <p className="small text-muted mt-n1 mb-2">{q.help}</p>}
              {q.fields.map((fd) => renderField(fd, q, single))}
            </fieldset>
          );
        })}
      </div>

      <div className="d-flex flex-wrap gap-2 justify-content-between">
        <button type="button" className="btn btn-link px-0" onClick={finishLater} disabled={saving}>
          Finish later
        </button>
        <div className="d-flex gap-2">
          {step > 0 && (
            <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={saving}>
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
            </button>
          )}
          {isLast ? (
            warning ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate("/dashboard", { replace: true })}>
                Continue to dashboard
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving && <Loader small />}
                {saving ? "Saving..." : "Save profile"}
              </button>
            )
          ) : (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Next<i className="bi bi-arrow-right ms-1" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {FILE_KEYS.some((k) => files[k]) && !isLast && (
        <p className="small text-muted mt-3">Files you choose are uploaded when you press 'Save profile'.</p>
      )}
    </div>
  );
}
