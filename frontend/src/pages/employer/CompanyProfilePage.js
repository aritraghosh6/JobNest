import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { profileApi } from '../../api/services';
import { API_ORIGIN } from '../../api/client';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import TagInput from '../../components/TagInput';
import { VerificationBadge } from '../../components/StatusBadge';
import CompanyFinder from '../../components/CompanyFinder';
import { COMPANY_SIZES, CULTURE_TAGS, cultureLabel, formatDate, getErrorCode, getErrorMessage, getFieldErrors, isUrl } from '../../utils/helpers';

const fromProfile = (p) => ({
  company_name: p?.company_name || '',
  industry: p?.industry || '',
  location: p?.location || '',
  website: p?.website || '',
  company_size: p?.company_size || '',
  company_description: p?.company_description || '',
  culture_description: p?.culture_description || '',
  values: p?.values || [],
  culture_tags: p?.culture_tags || [],
  job_preferences: {
    required_skills: p?.job_preferences?.required_skills || [],
    salary_range: p?.job_preferences?.salary_range || '',
  },
});

function CompanyForm({ profile, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromProfile(profile));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPref = (k, v) => setForm((f) => ({ ...f, job_preferences: { ...f.job_preferences, [k]: v } }));

  const validate = () => {
    const e = {};
    if (!form.company_name.trim()) e.company_name = 'Company name is required.';
    if (!form.industry.trim()) e.industry = 'Industry is required.';
    if (!form.location.trim()) e.location = 'Location is required.';
    if (form.website && !isUrl(form.website)) e.website = 'Enter a full URL starting with https://';
    if (form.company_description.trim().length < 30) e.company_description = 'Description must be at least 30 characters.';
    if (!form.job_preferences.required_skills.length) e['job_preferences.required_skills'] = 'Add at least one skill you look for.';
    return e;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return setError('Please correct the highlighted fields.');
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const text = (id, label, { required, placeholder, type = 'text', col = 'col-md-6' } = {}) => (
    <div className={col}>
      <label htmlFor={id} className={`form-label ${required ? 'required' : ''}`}>{label}</label>
      <input id={id} type={type} className={`form-control ${errors[id] ? 'is-invalid' : ''}`} value={form[id]} placeholder={placeholder} onChange={(e) => set(id, e.target.value)} aria-invalid={Boolean(errors[id])} />
      {errors[id] && <div className="invalid-feedback">{errors[id]}</div>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="fade-up">
      <FormAlert message={error} onClose={() => setError('')} />
      <section className="jn-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3">Company information</h2>
        <div className="row g-3">
          {text('company_name', 'Company name', { required: true })}
          {text('industry', 'Industry', { required: true, placeholder: 'e.g. Renewable energy' })}
          {text('location', 'Headquarters location', { required: true })}
          {text('website', 'Website', { type: 'url', placeholder: 'https://...' })}
          <div className="col-md-6">
            <label htmlFor="company_size" className="form-label">Company size</label>
            <select id="company_size" className="form-select" value={form.company_size} onChange={(e) => set('company_size', e.target.value)}>
              <option value="">Select...</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>
          <div className="col-12">
            <label htmlFor="company_description" className="form-label required">About the company</label>
            <textarea id="company_description" rows={4} maxLength={2000} className={`form-control ${errors.company_description ? 'is-invalid' : ''}`} value={form.company_description} onChange={(e) => set('company_description', e.target.value)} />
            {errors.company_description ? <div className="invalid-feedback">{errors.company_description}</div> : <div className="form-text">{form.company_description.length}/2000 characters (minimum 30)</div>}
          </div>
        </div>
      </section>

      <section className="jn-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3">Culture and values</h2>
        <div className="mb-3">
          <label htmlFor="culture_description" className="form-label">Describe your culture</label>
          <textarea id="culture_description" rows={4} maxLength={2000} className="form-control" value={form.culture_description} onChange={(e) => set('culture_description', e.target.value)} placeholder="How does your team work together? What is a typical week like?" />
        </div>
        <TagInput id="values" label="Company values" value={form.values} onChange={(v) => set('values', v)} placeholder="e.g. Safety first, Integrity" max={10} />
        <fieldset>
          <legend className="form-label">Culture traits (used for cultural-fit matching)</legend>
          <div className="row g-2">
            {CULTURE_TAGS.map((t) => (
              <div className="col-md-4" key={t.value}>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`culture-${t.value}`}
                    checked={form.culture_tags.includes(t.value)}
                    onChange={() => set('culture_tags', form.culture_tags.includes(t.value) ? form.culture_tags.filter((x) => x !== t.value) : [...form.culture_tags, t.value])}
                  />
                  <label className="form-check-label" htmlFor={`culture-${t.value}`}>
                    {t.label} <span className="small text-muted d-block">{t.hint}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="jn-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3">Hiring preferences</h2>
        <TagInput id="required_skills" label="Skills you usually look for" required value={form.job_preferences.required_skills} onChange={(v) => setPref('required_skills', v)} error={errors['job_preferences.required_skills']} />
        <div className="col-md-6">
          <label htmlFor="salary_range" className="form-label">Typical salary range</label>
          <input id="salary_range" className="form-control" maxLength={60} value={form.job_preferences.salary_range} onChange={(e) => setPref('salary_range', e.target.value)} placeholder="e.g. Rs. 5,00,000 - Rs. 9,00,000 per year" />
        </div>
      </section>

      <div className="d-flex gap-2 justify-content-end">
        {onCancel && <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary px-4" disabled={saving}>
          {saving && <Loader small />}{saving ? 'Saving...' : profile ? 'Save changes' : 'Create company profile'}
        </button>
      </div>
    </form>
  );
}

/** Recruiters who joined a company someone else registered: no documents needed, just the admin's confirmation. */
function MembershipCard({ profile }) {
  const v = profile.verification || {};
  const name = profile.joined_company_name || profile.company_name;
  return (
    <section id="verification" className="jn-card p-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 fw-bold mb-0">Your place at {name}</h2>
        <VerificationBadge status={v.status} />
      </div>
      {v.status === 'approved' && (
        <p className="mb-0 text-success">You're a confirmed recruiter at {name}. You can post jobs, and they appear under the company's page.</p>
      )}
      {v.status === 'pending' && (
        <p className="mb-0">You asked to join {name} on {formatDate(v.submitted_at)}. An administrator will confirm that you work there, then you can post jobs. We'll send you a notification.</p>
      )}
      {v.status === 'rejected' && (
        <div className="alert alert-danger small mb-0">
          Your request to join {name} was not approved{v.review_note ? `: ${v.review_note}` : '.'} Please contact the administrator if you think this is a mistake.
        </div>
      )}
    </section>
  );
}

function VerificationCard({ profile, onUpdated }) {
  if (profile.joined_company) return <MembershipCard profile={profile} />;
  return <CompanyVerificationCard profile={profile} onUpdated={onUpdated} />;
}

function CompanyVerificationCard({ profile, onUpdated }) {
  const v = profile.verification || { status: 'not_submitted' };
  const [regNo, setRegNo] = useState(v.registration_number || '');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = ['not_submitted', 'rejected'].includes(v.status);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9\-/ ]{5,50}$/.test(regNo.trim())) next.regNo = 'Enter a valid registration number (5-50 letters or digits).';
    if (!file) next.file = 'Please attach a registration certificate (PDF, PNG or JPG).';
    else if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) next.file = 'Only PDF, PNG or JPG files are allowed.';
    else if (file.size > 5 * 1024 * 1024) next.file = 'The file must be 5 MB or smaller.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await profileApi.submitVerification(regNo.trim(), file);
      onUpdated(res.profile);
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="verification" className="jn-card p-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 fw-bold mb-0">Company verification</h2>
        <VerificationBadge status={v.status} />
      </div>
      {message && <FormAlert type={message.type} message={message.text} onClose={() => setMessage(null)} />}
      {v.status === 'approved' && <p className="mb-0 text-success">Your company is verified. You can post jobs. Verified on {formatDate(v.reviewed_at)}.</p>}
      {v.status === 'pending' && (
        <p className="mb-0">Submitted on {formatDate(v.submitted_at)} (registration no. {v.registration_number}). An administrator is reviewing your documents.</p>
      )}
      {v.status === 'rejected' && (
        <div className="alert alert-danger small">
          Your previous request was rejected{v.review_note ? `: ${v.review_note}` : '.'} Please correct the details and submit again.
        </div>
      )}
      {canSubmit && (
        <form onSubmit={submit} noValidate>
          <p className="small text-muted">Submit your company registration number and certificate. Jobs can be posted after approval.</p>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label htmlFor="reg-no" className="form-label required">Registration number (CIN / GSTIN)</label>
              <input id="reg-no" className={`form-control ${errors.regNo ? 'is-invalid' : ''}`} value={regNo} onChange={(e) => setRegNo(e.target.value)} />
              {errors.regNo && <div className="invalid-feedback">{errors.regNo}</div>}
            </div>
            <div className="col-md-5">
              <label htmlFor="reg-doc" className="form-label required">Certificate</label>
              <input id="reg-doc" type="file" accept=".pdf,.png,.jpg,.jpeg" className={`form-control ${errors.file ? 'is-invalid' : ''}`} onChange={(e) => setFile(e.target.files[0] || null)} />
              {errors.file && <div className="invalid-feedback">{errors.file}</div>}
            </div>
            <div className="col-md-2 d-grid">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Loader small />}Submit</button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

export default function CompanyProfilePage() {
  const location = useLocation();
  const logoRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  // New employers first look for their company; "create" shows the form for a brand-new company
  const [mode, setMode] = useState('find');
  const [finderQuery, setFinderQuery] = useState('');

  useEffect(() => {
    profileApi
      .getMine()
      .then((d) => setProfile(d.profile))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && location.hash === '#verification') document.getElementById('verification')?.scrollIntoView({ behavior: 'smooth' });
  }, [loading, location.hash]);

  const save = async (body) => {
    let res;
    try {
      res = profile ? await profileApi.update(body) : await profileApi.create(body);
    } catch (err) {
      // The company is already registered: offer to join it instead of creating a duplicate
      if (!profile && getErrorCode(err) === 'COMPANY_EXISTS') {
        setFinderQuery(body.company_name);
        setMode('find');
        setError(getErrorMessage(err));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      throw err;
    }
    setProfile(res.profile);
    setEditing(false);
    setSuccess(profile ? res.message : 'Company profile created. Next, submit your verification documents below.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onLogo = async (e) => {
    const chosen = e.target.files[0];
    e.target.value = '';
    if (!chosen) return;
    if (!/\.(png|jpe?g|webp)$/i.test(chosen.name)) return setError('Logo must be a PNG, JPG or WEBP image.');
    if (chosen.size > 1024 * 1024) return setError('Logo must be 1 MB or smaller.');
    setLogoBusy(true);
    try {
      const res = await profileApi.uploadLogo(chosen);
      setProfile(res.profile);
      setSuccess(res.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLogoBusy(false);
    }
  };

  if (loading) return <Loader text="Loading company profile..." />;

  return (
    <div className="container py-4">
      <PageHeader
        icon="building"
        title={profile ? 'Company profile' : mode === 'find' ? 'Find your company' : 'Create your company profile'}
        subtitle="Show job seekers who you are, how you work and what you value."
        actions={profile && !editing && <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}><i className="bi bi-pencil me-1" aria-hidden="true" />Edit</button>}
      />
      <FormAlert message={error} onClose={() => setError('')} />
      <FormAlert type="success" message={success} onClose={() => setSuccess('')} />

      {!profile && mode === 'find' ? (
        <CompanyFinder
          key={finderQuery}
          initialQuery={finderQuery}
          onJoined={(res) => {
            setProfile(res.profile);
            setError('');
            setSuccess(res.message);
          }}
          onCreateNew={() => {
            setError('');
            setMode('create');
          }}
        />
      ) : !profile || editing ? (
        <CompanyForm profile={profile} onSave={save} onCancel={profile ? () => setEditing(false) : null} />
      ) : (
        <>
          <div className="jn-card p-4 fade-up">
            <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
              {profile.logo_url ? (
                <img src={`${API_ORIGIN}${profile.logo_url}`} alt={`${profile.company_name} logo`} className="company-logo" style={{ width: 80, height: 80 }} />
              ) : (
                <span className="icon-bubble" style={{ width: 80, height: 80, fontSize: '2rem' }} aria-hidden="true"><i className="bi bi-building" /></span>
              )}
              <div className="flex-grow-1">
                <h2 className="h4 fw-bold mb-0">{profile.company_name} <VerificationBadge status={profile.verification?.status} /></h2>
                <div className="text-muted">{profile.industry} &middot; {profile.location}{profile.company_size ? ` \u00b7 ${profile.company_size} employees` : ''}</div>
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="small">{profile.website}</a>}
              </div>
              <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="d-none" onChange={onLogo} aria-label="Upload company logo" />
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={logoBusy} onClick={() => logoRef.current.click()}>
                {logoBusy && <Loader small />}<i className="bi bi-image me-1" aria-hidden="true" />{profile.logo_url ? 'Change logo' : 'Upload logo'}
              </button>
            </div>
            <h3 className="h6 fw-bold">About</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{profile.company_description}</p>
            {profile.culture_description && (<><h3 className="h6 fw-bold">Culture</h3><p style={{ whiteSpace: 'pre-line' }}>{profile.culture_description}</p></>)}
            {profile.values?.length > 0 && (<><h3 className="h6 fw-bold">Values</h3><div className="mb-3">{profile.values.map((v) => <span key={v} className="skill-chip neutral">{v}</span>)}</div></>)}
            {profile.culture_tags?.length > 0 && (<><h3 className="h6 fw-bold">Culture traits</h3><div className="mb-3">{profile.culture_tags.map((t) => <span key={t} className="skill-chip">{cultureLabel(t)}</span>)}</div></>)}
            <h3 className="h6 fw-bold">Skills we look for</h3>
            <div>{profile.job_preferences?.required_skills?.map((s) => <span key={s} className="skill-chip neutral">{s}</span>)}</div>
            {profile.job_preferences?.salary_range && <p className="small text-muted mt-2 mb-0">Typical salary range: {profile.job_preferences.salary_range}</p>}
          </div>
          <VerificationCard profile={profile} onUpdated={setProfile} />
        </>
      )}
    </div>
  );
}
