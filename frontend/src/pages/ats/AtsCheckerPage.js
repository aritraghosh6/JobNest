import React, { useEffect, useRef, useState } from 'react';
import { resumeApi } from '../../api/services';
import { useConfirm } from '../../components/ConfirmDialog';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import ScoreRing from '../../components/ScoreRing';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const MAX_SIZE = 2 * 1024 * 1024;

function Results({ analysis, method }) {
  return (
    <div className="fade-up" id="ats-results">
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="jn-card p-4 text-center h-100">
            <h2 className="h6 fw-bold">ATS compatibility</h2>
            <ScoreRing score={analysis.overall_score} size={150} label="ATS compatibility score" />
            <p className="small text-muted mt-3 mb-0">
              {analysis.job_title} · {analysis.file_name}
              <br />
              {analysis.word_count} words read
            </p>
          </div>
        </div>
        <div className="col-md-8">
          <div className="jn-card p-4 h-100">
            <h2 className="h6 fw-bold">Score breakdown</h2>
            <div className="table-responsive">
              <table className="table align-middle small mb-2">
                <thead>
                  <tr><th scope="col">Component</th><th scope="col">Weight</th><th scope="col">Score</th><th scope="col">Details</th></tr>
                </thead>
                <tbody>
                  {analysis.breakdown.map((b) => (
                    <tr key={b.key} className={b.applicable ? '' : 'text-muted'}>
                      <th scope="row">{b.label}</th>
                      <td>{b.applicable ? `${b.weight}%` : 'Not scored'}</td>
                      <td>
                        {b.applicable ? (
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 6, minWidth: 60 }} aria-hidden="true">
                              <div className="progress-bar" style={{ width: `${b.score}%` }} />
                            </div>
                            <strong>{b.score}</strong>
                          </div>
                        ) : '—'}
                      </td>
                      <td>{b.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {method && <p className="small text-muted mb-0"><i className="bi bi-calculator me-1" aria-hidden="true" />{method.formula} {method.description}</p>}
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="jn-card p-4 h-100">
            <h2 className="h6 fw-bold"><i className="bi bi-check-circle text-success me-1" aria-hidden="true" />Matched skills ({analysis.matched_skills.length})</h2>
            {analysis.matched_skills.length ? analysis.matched_skills.map((s) => <span key={s} className="skill-chip">{s}</span>) : <p className="small text-muted mb-0">None of the required skills were found.</p>}
            <h2 className="h6 fw-bold mt-3"><i className="bi bi-x-circle text-danger me-1" aria-hidden="true" />Missing skills ({analysis.missing_skills.length})</h2>
            {analysis.missing_skills.length ? analysis.missing_skills.map((s) => <span key={s} className="skill-chip missing">{s}</span>) : <p className="small text-muted mb-0">No required skills are missing.</p>}
          </div>
        </div>
        <div className="col-md-6">
          <div className="jn-card p-4 h-100">
            <h2 className="h6 fw-bold">Job-description keywords found</h2>
            {analysis.keywords_found.length ? analysis.keywords_found.map((k) => <span key={k} className="skill-chip neutral">{k}</span>) : <p className="small text-muted">None found.</p>}
            <h2 className="h6 fw-bold mt-3">Keywords not found</h2>
            {analysis.keywords_missing.length ? analysis.keywords_missing.map((k) => <span key={k} className="skill-chip missing">{k}</span>) : <p className="small text-muted mb-0">All key terms are present.</p>}
          </div>
        </div>
      </div>

      <div className="jn-card p-4">
        <h2 className="h6 fw-bold"><i className="bi bi-lightbulb text-warning me-1" aria-hidden="true" />Recommendations</h2>
        <ol className="mb-0">
          {analysis.recommendations.map((r) => <li key={r} className="mb-2">{r}</li>)}
        </ol>
      </div>
    </div>
  );
}

export default function AtsCheckerPage() {
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState('job');
  const [jobs, setJobs] = useState([]);
  const [jobsNote, setJobsNote] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    resumeApi
      .jobs()
      .then((d) => {
        setJobs(d.jobs);
        if (!d.jobs.length) {
          setMode('custom');
          setJobsNote('There are no open jobs on JobNest right now, so paste a job description instead.');
        }
      })
      .catch((err) => {
        setMode('custom');
        setJobsNote(`${getErrorMessage(err)} You can still paste any job description.`);
      });
    resumeApi.history().then((d) => setHistory(d.history)).catch(() => {});
  }, []);

  const pickFile = (chosen) => {
    setErrors((e) => ({ ...e, file: undefined }));
    if (!chosen) return;
    const ext = chosen.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setFile(null);
      setErrors((e) => ({ ...e, file: 'Unsupported file type. Please upload a PDF or DOCX file.' }));
      return;
    }
    if (chosen.size > MAX_SIZE) {
      setFile(null);
      setErrors((e) => ({ ...e, file: 'The file is larger than 2 MB.' }));
      return;
    }
    setFile(chosen);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!file) next.file = 'Please choose your resume (PDF or DOCX).';
    if (mode === 'job' && !jobId) next.job = 'Please choose a job.';
    if (mode === 'custom' && jobDescription.trim().split(/\s+/).filter(Boolean).length < 25) {
      next.jobDescription = 'Please paste the full job description (at least 25 words).';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = await resumeApi.analyze(
        mode === 'job' ? { file, jobId } : { file, jobDescription: jobDescription.trim(), jobTitle: jobTitle.trim() },
        setProgress
      );
      setResult({ analysis: res.analysis, method: res.scoring_method });
      setHistory((h) => [res.analysis, ...h]);
      setTimeout(() => document.getElementById('ats-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };

  const openHistory = async (id) => {
    try {
      const res = await resumeApi.get(id);
      setResult({ analysis: res.analysis, method: res.scoring_method });
      setTimeout(() => document.getElementById('ats-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const deleteHistory = async (id) => {
    if (!(await confirm({ title: 'Delete this analysis?', message: 'This result will be removed from your history.', confirmText: 'Delete', tone: 'danger' }))) return;
    try {
      await resumeApi.remove(id);
      setHistory((h) => h.filter((x) => x._id !== id));
      if (result?.analysis._id === id) setResult(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="container py-4">
      <PageHeader icon="file-earmark-check" title="Resume ATS score checker" subtitle="See how well your resume lines up with a job description, and how to improve it honestly." />
      <div className="bg-accent-soft rounded-3 p-3 small mb-4">
        <i className="bi bi-info-circle me-1" aria-hidden="true" />
        This is a transparent, rule-based estimate made by JobNest. It is not the score of any commercial Applicant Tracking System.
        Your resume file is analysed in memory and is not stored; only the results are saved to your history.
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <form className="jn-card p-4" onSubmit={onSubmit} noValidate>
            <FormAlert message={error} onClose={() => setError('')} />
            <h2 className="h6 fw-bold">1. Upload your resume</h2>
            <div
              className={`dropzone mb-1 ${dragging ? 'dragging' : ''} ${errors.file ? 'border-danger' : ''}`}
              role="button"
              tabIndex={0}
              aria-describedby="file-help"
              onClick={() => fileRef.current.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileRef.current.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            >
              <i className="bi bi-cloud-arrow-up fs-1 text-primary" aria-hidden="true" />
              <div className="fw-semibold">{file ? file.name : 'Drag your resume here or click to browse'}</div>
              <div id="file-help" className="small text-muted">PDF or DOCX · maximum 2 MB · text-based (not scanned)</div>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx" className="d-none" onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ''; }} aria-label="Resume file" />
            {errors.file && <div className="text-danger small mb-2">{errors.file}</div>}

            <h2 className="h6 fw-bold mt-4">2. Choose the job</h2>
            <div className="btn-group mb-3" role="group" aria-label="Job description source">
              <input type="radio" className="btn-check" id="mode-job" checked={mode === 'job'} onChange={() => setMode('job')} disabled={!jobs.length} />
              <label className="btn btn-outline-primary" htmlFor="mode-job">A JobNest job</label>
              <input type="radio" className="btn-check" id="mode-custom" checked={mode === 'custom'} onChange={() => setMode('custom')} />
              <label className="btn btn-outline-primary" htmlFor="mode-custom">Paste a description</label>
            </div>
            {jobsNote && <div className="small text-muted mb-2">{jobsNote}</div>}

            {mode === 'job' ? (
              <div className="mb-3">
                <label htmlFor="job-select" className="form-label required">Job</label>
                <select id="job-select" className={`form-select ${errors.job ? 'is-invalid' : ''}`} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">Select a job…</option>
                  {jobs.some((j) => j.is_match) && (
                    <optgroup label="Matched to your profile">
                      {jobs.filter((j) => j.is_match).map((j) => (
                        <option key={j._id} value={j._id}>{j.title} — {j.company_name} ({j.match_score}% match)</option>
                      ))}
                    </optgroup>
                  )}
                  {jobs.some((j) => !j.is_match) && (
                    <optgroup label={jobs.some((j) => j.is_match) ? 'Other open jobs' : 'Open jobs'}>
                      {jobs.filter((j) => !j.is_match).map((j) => (
                        <option key={j._id} value={j._id}>{j.title} — {j.company_name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {errors.job && <div className="invalid-feedback">{errors.job}</div>}
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label htmlFor="job-title" className="form-label">Job title (optional)</label>
                  <input id="job-title" className="form-control" value={jobTitle} maxLength={150} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label htmlFor="job-desc" className="form-label required">Job description</label>
                  <textarea id="job-desc" rows={8} className={`form-control ${errors.jobDescription ? 'is-invalid' : ''}`} value={jobDescription} maxLength={8000} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the complete job description, including responsibilities and requirements." />
                  {errors.jobDescription && <div className="invalid-feedback">{errors.jobDescription}</div>}
                </div>
              </>
            )}

            {analyzing && (
              <div className="mb-3" aria-live="polite">
                <div className="small text-muted mb-1">{progress < 100 ? `Uploading… ${progress}%` : 'Reading and analysing your resume…'}</div>
                <div className="progress" style={{ height: 6 }} role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`progress-bar ${progress >= 100 ? 'progress-bar-striped progress-bar-animated' : ''}`} style={{ width: `${Math.max(progress, 5)}%` }} />
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={analyzing}>
              {analyzing && <Loader small />}
              {analyzing ? 'Analysing…' : 'Analyse my resume'}
            </button>
          </form>
        </div>
        <div className="col-lg-4">
          <div className="jn-card p-4">
            <h2 className="h6 fw-bold">Previous analyses</h2>
            {history.length === 0 && <p className="small text-muted mb-0">Your analyses will appear here.</p>}
            <ul className="list-unstyled mb-0">
              {history.map((h) => (
                <li key={h._id} className="d-flex align-items-center gap-2 py-2 border-bottom">
                  <span className={`badge text-bg-${h.overall_score >= 75 ? 'success' : h.overall_score >= 50 ? 'warning' : 'danger'}`}>{h.overall_score}</span>
                  <button type="button" className="btn btn-link p-0 text-start flex-grow-1 small text-truncate" onClick={() => openHistory(h._id)}>
                    {h.job_title}
                    <span className="d-block text-muted" style={{ fontSize: '0.75rem' }}>{formatDateTime(h.createdAt)}</span>
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteHistory(h._id)} aria-label={`Delete analysis for ${h.job_title}`}>
                    <i className="bi bi-trash" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {result && <Results analysis={result.analysis} method={result.method} />}
    </div>
  );
}
