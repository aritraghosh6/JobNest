import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jobApi, profileApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import TagInput from '../../components/TagInput';
import { CULTURE_TAGS, EMPLOYMENT_TYPES, getErrorCode, getErrorMessage, getFieldErrors } from '../../utils/helpers';

const EMPTY = {
  title: '',
  description: '',
  skills_required: [],
  qualifications: '',
  experience_min: 0,
  location: '',
  employment_type: 'full_time',
  is_remote: false,
  salary_min: '',
  salary_max: '',
  culture_tags: [],
  application_deadline: '',
  max_applicants: '',
};

const today = () => new Date().toISOString().slice(0, 10);

function validate(f) {
  const e = {};
  if (!f.title.trim()) e.title = 'Job title is required.';
  if (f.description.trim().length < 50) e.description = 'Description must be at least 50 characters.';
  if (!f.skills_required.length) e.skills_required = 'Add at least one required skill.';
  if (!f.location.trim()) e.location = 'Location is required.';
  const exp = Number(f.experience_min);
  if (Number.isNaN(exp) || exp < 0 || exp > 40) e.experience_min = 'Experience must be between 0 and 40 years.';
  const min = Number(f.salary_min);
  const max = Number(f.salary_max);
  if (f.salary_min === '' || Number.isNaN(min) || min < 0) e.salary_min = 'Enter a valid minimum salary.';
  if (f.salary_max === '' || Number.isNaN(max) || max < 0) e.salary_max = 'Enter a valid maximum salary.';
  else if (!e.salary_min && max < min) e.salary_max = 'Maximum must be greater than or equal to minimum.';
  if (f.application_deadline && f.application_deadline < today()) e.application_deadline = 'Deadline cannot be in the past.';
  if (f.max_applicants !== '' && f.max_applicants !== null) {
    const n = Number(f.max_applicants);
    if (!Number.isInteger(n) || n < 1 || n > 10000) e.max_applicants = 'Enter a whole number from 1 to 10000, or leave it empty for no limit.';
  }
  return e;
}

export default function JobFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [originalDeadline, setOriginalDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (isEdit) {
          const { job } = await jobApi.get(id);
          const deadline = job.application_deadline ? job.application_deadline.slice(0, 10) : '';
          setOriginalDeadline(deadline);
          setForm({
            ...EMPTY,
            ...job,
            qualifications: job.qualifications || '',
            application_deadline: deadline,
            max_applicants: job.max_applicants ?? '',
          });
        } else {
          const { profile } = await profileApi.getMine();
          if (!profile) setBlocked('Create your company profile before posting jobs.');
          else if (profile.verification?.status !== 'approved') setBlocked('Your company must be verified by an administrator before you can post jobs.');
          else setForm((f) => ({ ...f, culture_tags: profile.culture_tags || [], location: profile.location || '' }));
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate({ ...form, application_deadline: form.application_deadline === originalDeadline ? '' : form.application_deadline });
    setErrors(found);
    if (Object.keys(found).length) return setError('Please correct the highlighted fields.');
    setSaving(true);
    setError('');
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      skills_required: form.skills_required,
      qualifications: form.qualifications.trim(),
      experience_min: Number(form.experience_min),
      location: form.location.trim(),
      employment_type: form.employment_type,
      is_remote: form.is_remote,
      salary_min: Number(form.salary_min),
      salary_max: Number(form.salary_max),
      culture_tags: form.culture_tags,
      // On edit, an unchanged deadline is not re-validated
      application_deadline: form.application_deadline && form.application_deadline !== originalDeadline ? form.application_deadline : undefined,
      max_applicants: form.max_applicants === '' || form.max_applicants === null ? null : Number(form.max_applicants),
    };
    if (isEdit && !form.application_deadline && originalDeadline) body.application_deadline = null; // cleared by the user
    try {
      const res = isEdit ? await jobApi.update(id, body) : await jobApi.create(body);
      navigate('/employer/jobs', { state: { message: res.message } });
    } catch (err) {
      if (getErrorCode(err) === 'VERIFICATION_REQUIRED') setBlocked(getErrorMessage(err));
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader text="Loading…" />;

  if (blocked) {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <PageHeader icon="briefcase" title="Post a job" />
        <FormAlert type="warning" message={blocked}>
          {' '}<Link to="/company#verification">Go to company profile</Link>
        </FormAlert>
      </div>
    );
  }

  const field = (key, label, { type = 'text', required, col = 'col-md-6', ...rest } = {}) => (
    <div className={col}>
      <label htmlFor={key} className={`form-label ${required ? 'required' : ''}`}>{label}</label>
      <input id={key} type={type} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={Boolean(errors[key])} {...rest} />
      {errors[key] && <div className="invalid-feedback">{errors[key]}</div>}
    </div>
  );

  return (
    <div className="container py-4" style={{ maxWidth: 900 }}>
      <PageHeader icon="briefcase" title={isEdit ? 'Edit job' : 'Post a new job'} subtitle="Jobs are shown only to job seekers whose skills and preferences match." />
      <FormAlert message={error} onClose={() => setError('')} />
      <form onSubmit={onSubmit} noValidate className="fade-up">
        <section className="jn-card p-4 mb-4">
          <h2 className="h5 fw-bold mb-3">Role</h2>
          <div className="row g-3">
            {field('title', 'Job title', { required: true, col: 'col-12', maxLength: 120, placeholder: 'e.g. SCADA Engineer' })}
            <div className="col-12">
              <label htmlFor="description" className="form-label required">Job description</label>
              <textarea id="description" rows={7} maxLength={5000} className={`form-control ${errors.description ? 'is-invalid' : ''}`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Responsibilities, team, tools, what success looks like…" />
              {errors.description ? <div className="invalid-feedback">{errors.description}</div> : <div className="form-text">{form.description.length}/5000 characters (minimum 50)</div>}
            </div>
            <div className="col-12">
              <TagInput id="skills_required" label="Required skills" required value={form.skills_required} onChange={(v) => set('skills_required', v)} error={errors.skills_required} placeholder="e.g. Python, SCADA" />
            </div>
            <div className="col-12">
              <label htmlFor="qualifications" className="form-label">Qualifications</label>
              <textarea id="qualifications" rows={3} maxLength={1000} className="form-control" value={form.qualifications} onChange={(e) => set('qualifications', e.target.value)} placeholder="e.g. B.Tech in Electrical Engineering" />
            </div>
            {field('experience_min', 'Minimum experience (years)', { type: 'number', min: 0, max: 40, col: 'col-md-4' })}
          </div>
        </section>

        <section className="jn-card p-4 mb-4">
          <h2 className="h5 fw-bold mb-3">Location, type and salary</h2>
          <div className="row g-3">
            {field('location', 'Location', { required: true })}
            <div className="col-md-6">
              <label htmlFor="employment_type" className="form-label required">Employment type</label>
              <select id="employment_type" className="form-select" value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-12">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="is_remote" checked={form.is_remote} onChange={(e) => set('is_remote', e.target.checked)} />
                <label className="form-check-label" htmlFor="is_remote">Remote work possible</label>
              </div>
            </div>
            {field('salary_min', 'Minimum salary (₹ per year)', { type: 'number', min: 0, required: true, col: 'col-md-4' })}
            {field('salary_max', 'Maximum salary (₹ per year)', { type: 'number', min: 0, required: true, col: 'col-md-4' })}
            {field('application_deadline', 'Application deadline', { type: 'date', min: today(), col: 'col-md-4' })}
            {field('max_applicants', 'Applicant limit (optional)', { type: 'number', min: 1, max: 10000, col: 'col-md-4', placeholder: 'e.g. 50' })}
            <div className="col-md-8 d-flex align-items-end">
              <p className="small text-muted mb-2">
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                When this many people have applied, the job closes to new applicants and you get an alert. Leave empty for no limit.
              </p>
            </div>
          </div>
        </section>

        <section className="jn-card p-4 mb-4">
          <h2 className="h5 fw-bold mb-1">Team culture</h2>
          <p className="small text-muted">Used to calculate cultural fit with each candidate's assessment.</p>
          <div className="d-flex flex-wrap gap-3">
            {CULTURE_TAGS.map((t) => (
              <div className="form-check" key={t.value}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`job-culture-${t.value}`}
                  checked={form.culture_tags.includes(t.value)}
                  onChange={() => set('culture_tags', form.culture_tags.includes(t.value) ? form.culture_tags.filter((x) => x !== t.value) : [...form.culture_tags, t.value])}
                />
                <label className="form-check-label" htmlFor={`job-culture-${t.value}`}>{t.label}</label>
              </div>
            ))}
          </div>
        </section>

        <div className="d-flex justify-content-end gap-2">
          <Link to="/employer/jobs" className="btn btn-outline-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary px-4" disabled={saving}>
            {saving && <Loader small />}{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Publish job'}
          </button>
        </div>
      </form>
    </div>
  );
}
