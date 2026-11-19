import React, { useState } from 'react';
import TagInput from '../../components/TagInput';
import FormAlert from '../../components/FormAlert';
import Loader from '../../components/Loader';
import { EMPLOYMENT_TYPES, getErrorMessage, getFieldErrors, isUrl } from '../../utils/helpers';

const emptyEducation = { institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', grade: '' };
const emptyExperience = { title: '', organization: '', type: 'job', start_date: '', end_date: '', is_current: false, description: '' };
const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

function fromProfile(p, fallbackName) {
  return {
    full_name: p?.full_name || fallbackName || '',
    phone: p?.phone || '',
    location: p?.location || '',
    headline: p?.headline || '',
    summary: p?.summary || '',
    skills: p?.skills || [],
    education: (p?.education || []).map((e) => ({ ...emptyEducation, ...e, start_year: e.start_year || '', end_year: e.end_year || '' })),
    experience: (p?.experience || []).map((e) => ({
      ...emptyExperience,
      ...e,
      start_date: toDateInput(e.start_date),
      end_date: toDateInput(e.end_date),
    })),
    job_preferences: {
      desired_roles: p?.job_preferences?.desired_roles || [],
      preferred_locations: p?.job_preferences?.preferred_locations || [],
      job_types: p?.job_preferences?.job_types || [],
      expected_salary: p?.job_preferences?.expected_salary ?? '',
      open_to_remote: Boolean(p?.job_preferences?.open_to_remote),
    },
    social_links: {
      linkedin: p?.social_links?.linkedin || '',
      github: p?.social_links?.github || '',
      portfolio: p?.social_links?.portfolio || '',
    },
  };
}

function validate(f) {
  const e = {};
  const year = new Date().getFullYear();
  if (!f.full_name.trim()) e.full_name = 'Full name is required.';
  if (!f.location.trim()) e.location = 'Location is required.';
  if (f.phone && !/^[+]?[\d\s-]{7,15}$/.test(f.phone)) e.phone = 'Enter a valid phone number.';
  if (!f.skills.length) e.skills = 'Add at least one skill.';
  if (!f.job_preferences.desired_roles.length) e['job_preferences.desired_roles'] = 'Add at least one role you are looking for.';
  if (!f.job_preferences.job_types.length) e['job_preferences.job_types'] = 'Choose at least one job type.';
  if (f.job_preferences.expected_salary !== '' && (Number.isNaN(Number(f.job_preferences.expected_salary)) || Number(f.job_preferences.expected_salary) < 0)) {
    e['job_preferences.expected_salary'] = 'Expected salary must be a positive number.';
  }
  f.education.forEach((ed, i) => {
    if (!ed.institution.trim() || !ed.degree.trim()) e[`education.${i}`] = 'Institution and degree are required.';
    else if (ed.start_year && (ed.start_year < 1950 || ed.start_year > year + 1)) e[`education.${i}`] = 'Start year looks incorrect.';
    else if (ed.start_year && ed.end_year && Number(ed.end_year) < Number(ed.start_year)) e[`education.${i}`] = 'End year cannot be before start year.';
  });
  f.experience.forEach((ex, i) => {
    if (!ex.title.trim() || !ex.organization.trim()) e[`experience.${i}`] = 'Title and organization are required.';
    else if (ex.start_date && ex.start_date > new Date().toISOString().slice(0, 10)) e[`experience.${i}`] = 'Start date cannot be in the future.';
    else if (!ex.is_current && ex.start_date && ex.end_date && ex.end_date < ex.start_date) e[`experience.${i}`] = 'End date cannot be before start date.';
  });
  Object.entries(f.social_links).forEach(([k, v]) => {
    if (v && !isUrl(v)) e[`social_links.${k}`] = 'Enter a full URL starting with https://';
  });
  return e;
}

export default function SeekerProfileForm({ profile, userName, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromProfile(profile, userName));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setPref = (key, value) => setForm((f) => ({ ...f, job_preferences: { ...f.job_preferences, [key]: value } }));
  const setSocial = (key, value) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [key]: value } }));
  const setListItem = (list, index, key, value) =>
    setForm((f) => ({ ...f, [list]: f[list].map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));
  const addItem = (list, empty) => setForm((f) => ({ ...f, [list]: [...f[list], { ...empty }] }));
  const removeItem = (list, index) => setForm((f) => ({ ...f, [list]: f[list].filter((_, i) => i !== index) }));

  const toggleJobType = (value) => {
    const types = form.job_preferences.job_types;
    setPref('job_types', types.includes(value) ? types.filter((t) => t !== value) : [...types, value]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setError('Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        education: form.education.map((ed) => ({
          ...ed,
          start_year: ed.start_year === '' ? undefined : Number(ed.start_year),
          end_year: ed.end_year === '' ? undefined : Number(ed.end_year),
        })),
        job_preferences: {
          ...form.job_preferences,
          expected_salary: form.job_preferences.expected_salary === '' ? undefined : Number(form.job_preferences.expected_salary),
        },
      });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const input = (id, label, value, onChange, { required, type = 'text', placeholder, error, col = 'col-md-6' } = {}) => (
    <div className={col}>
      <label htmlFor={id} className={`form-label ${required ? 'required' : ''}`}>{label}</label>
      <input
        id={id}
        type={type}
        className={`form-control ${error ? 'is-invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="fade-up">
      <FormAlert message={error} onClose={() => setError('')} />

      <section className="jn-card p-4 mb-4" aria-labelledby="basic-heading">
        <h2 id="basic-heading" className="h5 fw-bold mb-3">Basic information</h2>
        <div className="row g-3">
          {input('full_name', 'Full name', form.full_name, (v) => set('full_name', v), { required: true, error: errors.full_name })}
          {input('phone', 'Phone', form.phone, (v) => set('phone', v), { type: 'tel', placeholder: '+91 98765 43210', error: errors.phone })}
          {input('location', 'Current location', form.location, (v) => set('location', v), { required: true, placeholder: 'e.g. Kolkata', error: errors.location })}
          {input('headline', 'Professional headline', form.headline, (v) => set('headline', v), { placeholder: 'e.g. Electrical engineer | SCADA & power systems' })}
          <div className="col-12">
            <label htmlFor="summary" className="form-label">Summary</label>
            <textarea id="summary" className="form-control" rows={4} maxLength={1500} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
            <div className="form-text">{form.summary.length}/1500 characters</div>
          </div>
        </div>
      </section>

      <section className="jn-card p-4 mb-4" aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="h5 fw-bold mb-3">Skills and job preferences</h2>
        <TagInput id="skills" label="Skills" required value={form.skills} onChange={(v) => set('skills', v)} placeholder="e.g. React, Python, SCADA" error={errors.skills} />
        <div className="row g-3">
          <div className="col-md-6">
            <TagInput id="desired_roles" label="Roles you are looking for" required value={form.job_preferences.desired_roles} onChange={(v) => setPref('desired_roles', v)} placeholder="e.g. Frontend Developer" error={errors['job_preferences.desired_roles']} />
          </div>
          <div className="col-md-6">
            <TagInput id="preferred_locations" label="Preferred locations" value={form.job_preferences.preferred_locations} onChange={(v) => setPref('preferred_locations', v)} placeholder="e.g. Bengaluru, Pune" help='Type "Any" if location does not matter.' />
          </div>
        </div>
        <fieldset className="mb-3">
          <legend className="form-label required">Job types</legend>
          <div className="d-flex flex-wrap gap-3">
            {EMPLOYMENT_TYPES.map((t) => (
              <div className="form-check" key={t.value}>
                <input className={`form-check-input ${errors['job_preferences.job_types'] ? 'is-invalid' : ''}`} type="checkbox" id={`type-${t.value}`} checked={form.job_preferences.job_types.includes(t.value)} onChange={() => toggleJobType(t.value)} />
                <label className="form-check-label" htmlFor={`type-${t.value}`}>{t.label}</label>
              </div>
            ))}
          </div>
          {errors['job_preferences.job_types'] && <div className="invalid-feedback d-block">{errors['job_preferences.job_types']}</div>}
        </fieldset>
        <div className="row g-3 align-items-end">
          {input('expected_salary', 'Expected annual salary (₹)', form.job_preferences.expected_salary, (v) => setPref('expected_salary', v), { type: 'number', error: errors['job_preferences.expected_salary'] })}
          <div className="col-md-6">
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" role="switch" id="open_to_remote" checked={form.job_preferences.open_to_remote} onChange={(e) => setPref('open_to_remote', e.target.checked)} />
              <label className="form-check-label" htmlFor="open_to_remote">Open to remote work</label>
            </div>
          </div>
        </div>
      </section>

      <section className="jn-card p-4 mb-4" aria-labelledby="education-heading">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 id="education-heading" className="h5 fw-bold mb-0">Education</h2>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem('education', emptyEducation)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />Add education
          </button>
        </div>
        {form.education.length === 0 && <p className="text-muted small mb-0">No education added yet.</p>}
        {form.education.map((ed, i) => (
          <fieldset key={i} className="border rounded-3 p-3 mb-3">
            <legend className="visually-hidden">Education {i + 1}</legend>
            {errors[`education.${i}`] && <div className="text-danger small mb-2">{errors[`education.${i}`]}</div>}
            <div className="row g-2">
              {input(`edu-inst-${i}`, 'Institution', ed.institution, (v) => setListItem('education', i, 'institution', v), { required: true })}
              {input(`edu-degree-${i}`, 'Degree', ed.degree, (v) => setListItem('education', i, 'degree', v), { required: true, placeholder: 'e.g. B.Tech' })}
              {input(`edu-field-${i}`, 'Field of study', ed.field_of_study, (v) => setListItem('education', i, 'field_of_study', v), { col: 'col-md-4' })}
              {input(`edu-start-${i}`, 'Start year', ed.start_year, (v) => setListItem('education', i, 'start_year', v), { type: 'number', col: 'col-md-2' })}
              {input(`edu-end-${i}`, 'End year', ed.end_year, (v) => setListItem('education', i, 'end_year', v), { type: 'number', col: 'col-md-2' })}
              {input(`edu-grade-${i}`, 'Grade / CGPA', ed.grade, (v) => setListItem('education', i, 'grade', v), { col: 'col-md-2' })}
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-outline-danger w-100" onClick={() => removeItem('education', i)} aria-label={`Remove education ${i + 1}`}>
                  <i className="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          </fieldset>
        ))}
      </section>

      <section className="jn-card p-4 mb-4" aria-labelledby="experience-heading">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 id="experience-heading" className="h5 fw-bold mb-0">Experience, internships and projects</h2>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem('experience', emptyExperience)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />Add entry
          </button>
        </div>
        {form.experience.length === 0 && <p className="text-muted small mb-0">No experience added yet. Freshers can add projects here.</p>}
        {form.experience.map((ex, i) => (
          <fieldset key={i} className="border rounded-3 p-3 mb-3">
            <legend className="visually-hidden">Experience {i + 1}</legend>
            {errors[`experience.${i}`] && <div className="text-danger small mb-2">{errors[`experience.${i}`]}</div>}
            <div className="row g-2">
              <div className="col-md-3">
                <label htmlFor={`exp-type-${i}`} className="form-label">Type</label>
                <select id={`exp-type-${i}`} className="form-select" value={ex.type} onChange={(e) => setListItem('experience', i, 'type', e.target.value)}>
                  <option value="job">Job</option>
                  <option value="internship">Internship</option>
                  <option value="project">Project</option>
                </select>
              </div>
              {input(`exp-title-${i}`, 'Title', ex.title, (v) => setListItem('experience', i, 'title', v), { required: true, col: 'col-md-5' })}
              {input(`exp-org-${i}`, 'Organization', ex.organization, (v) => setListItem('experience', i, 'organization', v), { required: true, col: 'col-md-4' })}
              {input(`exp-start-${i}`, 'Start date', ex.start_date, (v) => setListItem('experience', i, 'start_date', v), { type: 'date', col: 'col-md-4' })}
              {!ex.is_current && input(`exp-end-${i}`, 'End date', ex.end_date, (v) => setListItem('experience', i, 'end_date', v), { type: 'date', col: 'col-md-4' })}
              <div className="col-md-4 d-flex align-items-end">
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id={`exp-current-${i}`} checked={ex.is_current} onChange={(e) => setListItem('experience', i, 'is_current', e.target.checked)} />
                  <label className="form-check-label" htmlFor={`exp-current-${i}`}>I currently work here</label>
                </div>
              </div>
              <div className="col-12">
                <label htmlFor={`exp-desc-${i}`} className="form-label">Description</label>
                <textarea id={`exp-desc-${i}`} className="form-control" rows={2} maxLength={1000} value={ex.description} onChange={(e) => setListItem('experience', i, 'description', e.target.value)} />
              </div>
              <div className="col-12 text-end">
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeItem('experience', i)}>
                  <i className="bi bi-trash me-1" aria-hidden="true" />Remove entry
                </button>
              </div>
            </div>
          </fieldset>
        ))}
      </section>

      <section className="jn-card p-4 mb-4" aria-labelledby="social-heading">
        <h2 id="social-heading" className="h5 fw-bold mb-3">Social and portfolio links</h2>
        <div className="row g-3">
          {input('linkedin', 'LinkedIn', form.social_links.linkedin, (v) => setSocial('linkedin', v), { type: 'url', col: 'col-md-4', placeholder: 'https://linkedin.com/in/…', error: errors['social_links.linkedin'] })}
          {input('github', 'GitHub', form.social_links.github, (v) => setSocial('github', v), { type: 'url', col: 'col-md-4', placeholder: 'https://github.com/…', error: errors['social_links.github'] })}
          {input('portfolio', 'Portfolio', form.social_links.portfolio, (v) => setSocial('portfolio', v), { type: 'url', col: 'col-md-4', placeholder: 'https://…', error: errors['social_links.portfolio'] })}
        </div>
      </section>

      <div className="d-flex gap-2 justify-content-end">
        {onCancel && <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary px-4" disabled={saving}>
          {saving && <Loader small />}
          {saving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}
        </button>
      </div>
    </form>
  );
}
