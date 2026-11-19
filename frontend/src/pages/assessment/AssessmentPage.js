import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { assessmentApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const PER_PAGE = 5;

export default function AssessmentPage() {
  const { patchUser } = useAuth();
  const navigate = useNavigate();
  const topRef = useRef(null);
  const [data, setData] = useState(null);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showMissing, setShowMissing] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([assessmentApi.questions(), assessmentApi.latest()])
      .then(([q, l]) => {
        setData(q);
        setLatest(l.report);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading the assessment…" />;
  if (!data) return <div className="container py-4"><FormAlert message={error || 'Could not load the assessment.'} /></div>;

  const questions = data.questions;
  const pages = Math.ceil(questions.length / PER_PAGE);
  const pageQuestions = questions.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);
  const pageComplete = pageQuestions.every((q) => answers[q.id]);

  const goTo = (next) => {
    setShowMissing(false);
    setPage(next);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onNext = () => {
    if (!pageComplete) {
      setShowMissing(true);
      return;
    }
    goTo(page + 1);
  };

  const onSubmit = async () => {
    if (answeredCount < questions.length) {
      setShowMissing(true);
      setError(`Please answer all ${questions.length} questions. The assessment cannot be skipped.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await assessmentApi.submit(Object.entries(answers).map(([question_id, value]) => ({ question_id, value })));
      patchUser({ assessment_completed: true });
      navigate(`/assessment/report/${res.report.id}`, { state: { justCompleted: true } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!started) {
    return (
      <div className="container py-4" style={{ maxWidth: 820 }}>
        <PageHeader icon="clipboard-check" title="Personality and work-style assessment" subtitle="Helps JobNest estimate your cultural fit with employers." />
        {latest && (
          <FormAlert type="info" message={`You completed this assessment on ${formatDate(latest.completed_at)}. Taking it again creates a new report, which will be used for matching.`}>
            {' '}<Link to="/assessment/report">View your current report</Link>
          </FormAlert>
        )}
        <div className="jn-card p-4 p-md-5 fade-up">
          <h2 className="h5 fw-bold mb-3">Before you begin</h2>
          <ul className="mb-4">
            {data.instructions.map((line) => <li key={line} className="mb-2">{line}</li>)}
          </ul>
          <div className="bg-accent-soft rounded-3 p-3 small mb-4">
            <i className="bi bi-info-circle me-2" aria-hidden="true" />
            This questionnaire was written for JobNest. It is <strong>not</strong> a clinical or scientifically validated
            personality test, and results are indicative only.
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setStarted(true)}>
            Start assessment <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 820 }} ref={topRef}>
      <PageHeader icon="clipboard-check" title="Work-style assessment" subtitle={`Section ${page + 1} of ${pages}`} />
      <div className="mb-4">
        <div className="d-flex justify-content-between small text-muted mb-1">
          <span>{answeredCount} of {questions.length} answered</span>
          <span>{progress}%</span>
        </div>
        <div className="progress" style={{ height: 8 }} role="progressbar" aria-label="Assessment progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
      <FormAlert message={error} onClose={() => setError('')} />
      {showMissing && !pageComplete && <FormAlert type="warning" message="Please answer every question in this section to continue." />}

      <div key={page} className="stagger">
        {pageQuestions.map((q, idx) => {
          const number = page * PER_PAGE + idx + 1;
          const missing = showMissing && !answers[q.id];
          return (
            <fieldset key={q.id} className={`jn-card p-4 mb-3 question-card ${missing ? 'unanswered' : ''}`}>
              <legend className="fs-6 fw-semibold mb-3">
                <span className="text-primary me-2">{number}.</span>{q.text}
                {missing && <span className="visually-hidden"> (not answered)</span>}
              </legend>
              <div className="likert">
                {data.scale.map((opt) => {
                  const id = `${q.id}-${opt.value}`;
                  return (
                    <div key={opt.value} className="position-relative">
                      <input type="radio" id={id} name={q.id} value={opt.value} checked={answers[q.id] === opt.value} onChange={() => setAnswers({ ...answers, [q.id]: opt.value })} />
                      <label htmlFor={id} className="w-100">{opt.label}</label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="d-flex justify-content-between mt-4">
        <button type="button" className="btn btn-outline-secondary" disabled={page === 0} onClick={() => goTo(page - 1)}>
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
        </button>
        {page < pages - 1 ? (
          <button type="button" className="btn btn-primary" onClick={onNext}>
            Next <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader small />}
            {submitting ? 'Calculating…' : 'Submit and see my report'}
          </button>
        )}
      </div>
    </div>
  );
}
