import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/services';
import { useConfirm } from '../../components/ConfirmDialog';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import SeekerProfileForm from './SeekerProfileForm';
import { formatDate, formatMoney, formatSize, getErrorMessage, typeLabel } from '../../utils/helpers';

const DOCS = [
  { type: 'resume', label: 'Resume', icon: 'file-earmark-person' },
  { type: 'cover_letter', label: 'Cover letter', icon: 'file-earmark-text' },
];

function DocumentRow({ doc, file, onChanged }) {
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);

  const onPick = async (e) => {
    const chosen = e.target.files[0];
    e.target.value = '';
    if (!chosen) return;
    const ext = chosen.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) return setMessage({ type: 'danger', text: 'Only PDF or DOCX files are allowed.' });
    if (chosen.size > 2 * 1024 * 1024) return setMessage({ type: 'danger', text: 'The file must be 2 MB or smaller.' });
    setBusy(true);
    setMessage(null);
    try {
      const res = await profileApi.uploadDocument(doc.type, chosen, setProgress);
      onChanged(res.profile);
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onDelete = async () => {
    if (!(await confirm({ title: `Remove your ${doc.label.toLowerCase()}?`, message: 'Employers will no longer see it on new applications.', confirmText: 'Remove', tone: 'danger' }))) return;
    setBusy(true);
    try {
      const res = await profileApi.deleteDocument(doc.type);
      onChanged(res.profile);
      setMessage({ type: 'success', text: `${doc.label} removed.` });
    } catch (err) {
      setMessage({ type: 'danger', text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = () => profileApi.downloadDocument(doc.type).catch((err) => setMessage({ type: 'danger', text: getErrorMessage(err) }));

  return (
    <div className="py-3 border-bottom">
      <div className="d-flex flex-wrap align-items-center gap-3">
        <span className="icon-bubble" aria-hidden="true"><i className={`bi bi-${doc.icon}`} /></span>
        <div className="flex-grow-1">
          <div className="fw-semibold">{doc.label}</div>
          <div className="small text-muted">
            {file ? `${file.original_name} · ${formatSize(file.size)} · uploaded ${formatDate(file.uploaded_at)}` : 'Not uploaded · PDF or DOCX, max 2 MB'}
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.docx" className="d-none" onChange={onPick} aria-label={`Upload ${doc.label}`} />
        <div className="d-flex gap-2">
          {file && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDownload} aria-label={`Download ${doc.label}`}>
              <i className="bi bi-download" aria-hidden="true" />
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => inputRef.current.click()}>
            {busy && <Loader small />}
            {file ? 'Replace' : 'Upload'}
          </button>
          {file && (
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={onDelete} aria-label={`Delete ${doc.label}`}>
              <i className="bi bi-trash" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {busy && progress > 0 && (
        <div className="progress mt-2" style={{ height: 6 }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <div className={`small mt-2 text-${message.type}`} role="status">{message.text}</div>}
    </div>
  );
}

function ProfileView({ profile }) {
  const prefs = profile.job_preferences || {};
  return (
    <div className="row g-4 stagger">
      <div className="col-12">
        <div className="jn-card p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <span className="avatar" style={{ width: 64, height: 64, fontSize: '1.4rem' }} aria-hidden="true">
              {profile.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
            <div>
              <h2 className="h4 fw-bold mb-0">{profile.full_name}</h2>
              {profile.headline && <div className="text-muted">{profile.headline}</div>}
              <div className="small text-muted">
                <i className="bi bi-geo-alt me-1" aria-hidden="true" />{profile.location}
                {profile.phone && <><span className="mx-2">·</span><i className="bi bi-telephone me-1" aria-hidden="true" />{profile.phone}</>}
              </div>
            </div>
          </div>
          {profile.summary && <p className="mb-3" style={{ whiteSpace: 'pre-line' }}>{profile.summary}</p>}
          <h3 className="h6 fw-bold">Skills</h3>
          <div>{profile.skills.map((s) => <span className="skill-chip" key={s}>{s}</span>)}</div>
          {(profile.social_links?.linkedin || profile.social_links?.github || profile.social_links?.portfolio) && (
            <div className="d-flex gap-3 mt-2">
              {profile.social_links.linkedin && <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer"><i className="bi bi-linkedin me-1" aria-hidden="true" />LinkedIn</a>}
              {profile.social_links.github && <a href={profile.social_links.github} target="_blank" rel="noreferrer"><i className="bi bi-github me-1" aria-hidden="true" />GitHub</a>}
              {profile.social_links.portfolio && <a href={profile.social_links.portfolio} target="_blank" rel="noreferrer"><i className="bi bi-globe me-1" aria-hidden="true" />Portfolio</a>}
            </div>
          )}
        </div>
      </div>
      <div className="col-md-6">
        <div className="jn-card p-4 h-100">
          <h3 className="h6 fw-bold">Job preferences</h3>
          <dl className="row small mb-0">
            <dt className="col-5">Roles</dt><dd className="col-7">{prefs.desired_roles?.join(', ')}</dd>
            <dt className="col-5">Locations</dt><dd className="col-7">{prefs.preferred_locations?.join(', ') || 'Not specified'}</dd>
            <dt className="col-5">Job types</dt><dd className="col-7">{prefs.job_types?.map(typeLabel).join(', ')}</dd>
            <dt className="col-5">Expected salary</dt><dd className="col-7">{prefs.expected_salary ? `${formatMoney(prefs.expected_salary)} / year` : 'Not specified'}</dd>
            <dt className="col-5">Remote</dt><dd className="col-7">{prefs.open_to_remote ? 'Open to remote work' : 'No'}</dd>
          </dl>
        </div>
      </div>
      <div className="col-md-6">
        <div className="jn-card p-4 h-100">
          <h3 className="h6 fw-bold">Education</h3>
          {profile.education.length === 0 && <p className="text-muted small mb-0">No education added.</p>}
          {profile.education.map((e) => (
            <div key={e._id} className="mb-2">
              <div className="fw-semibold">{e.degree}{e.field_of_study ? `, ${e.field_of_study}` : ''}</div>
              <div className="small text-muted">{e.institution} {e.start_year ? `· ${e.start_year}–${e.end_year || 'present'}` : ''} {e.grade ? `· ${e.grade}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-12">
        <div className="jn-card p-4">
          <h3 className="h6 fw-bold">Experience, internships and projects</h3>
          {profile.experience.length === 0 && <p className="text-muted small mb-0">No experience added.</p>}
          {profile.experience.map((x) => (
            <div key={x._id} className="mb-3">
              <div className="fw-semibold">
                {x.title} · {x.organization} <span className="badge text-bg-light text-capitalize">{x.type}</span>
              </div>
              <div className="small text-muted">
                {x.start_date ? formatDate(x.start_date) : ''} {x.start_date ? '–' : ''} {x.is_current ? 'Present' : x.end_date ? formatDate(x.end_date) : ''}
              </div>
              {x.description && <div className="small mt-1">{x.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SeekerProfilePage() {
  const { user, patchUser } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    profileApi
      .getMine()
      .then((d) => setProfile(d.profile))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const save = async (body) => {
    const res = profile ? await profileApi.update(body) : await profileApi.create(body);
    setProfile(res.profile);
    setEditing(false);
    setSuccess(res.message);
    patchUser({ profile_completed: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <Loader text="Loading your profile…" />;

  const showForm = !profile || editing;

  return (
    <div className="container py-4">
      <PageHeader
        icon="person"
        title={profile ? 'My profile' : 'Create your profile'}
        subtitle={profile ? 'This is what employers see when you apply.' : 'Tell employers about your skills, experience and what you are looking for.'}
        actions={profile && !editing && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(true); setSuccess(''); }}>
            <i className="bi bi-pencil me-1" aria-hidden="true" />Edit profile
          </button>
        )}
      />
      {location.state?.welcome && !profile && <FormAlert type="info" message="Welcome to JobNest! Start by creating your profile." />}
      <FormAlert message={error} onClose={() => setError('')} />
      <FormAlert type="success" message={success} onClose={() => setSuccess('')}>
        {success && !user.assessment_completed && <> Next step: <Link to="/assessment">take the personality assessment</Link>.</>}
      </FormAlert>

      {showForm ? (
        <SeekerProfileForm profile={profile} userName={user.name} onSave={save} onCancel={profile ? () => setEditing(false) : null} />
      ) : (
        <>
          <ProfileView profile={profile} />
          <div className="jn-card p-4 mt-4 fade-up">
            <h2 className="h5 fw-bold mb-1">Documents</h2>
            <p className="text-muted small mb-2">Your resume is shared with employers only when you apply for their job.</p>
            {DOCS.map((doc) => <DocumentRow key={doc.type} doc={doc} file={profile[doc.type]} onChanged={setProfile} />)}
          </div>
        </>
      )}
    </div>
  );
}
