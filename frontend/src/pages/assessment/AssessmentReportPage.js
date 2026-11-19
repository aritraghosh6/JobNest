import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { assessmentApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const LEVEL_COLOR = { high: 'success', moderate: 'warning', low: 'secondary' };

export default function AssessmentReportPage() {
  const { id } = useParams();
  const location = useLocation();
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([id ? assessmentApi.byId(id) : assessmentApi.latest(), assessmentApi.history()])
      .then(([r, h]) => {
        setReport(r.report);
        setHistory(h.history);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader text="Loading your report…" />;

  return (
    <div className="container py-4">
      <PageHeader
        icon="bar-chart"
        title="Your cultural-fit report"
        subtitle={report ? `Completed on ${formatDate(report.completed_at)}` : undefined}
        actions={<Link to="/assessment" className="btn btn-outline-primary">Retake assessment</Link>}
      />
      <FormAlert message={error} />
      {location.state?.justCompleted && (
        <FormAlert type="success" message="Assessment submitted. Matched jobs are now unlocked.">
          {' '}<Link to="/jobs">See your matched jobs</Link>
        </FormAlert>
      )}

      {!report && !error && (
        <EmptyState icon="clipboard-check" title="No report yet" text="Complete the assessment to see your report." action={<Link to="/assessment" className="btn btn-primary">Start assessment</Link>} />
      )}

      {report && (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="jn-card p-4 mb-4 fade-up">
              <h2 className="h5 fw-bold">Summary</h2>
              <p className="mb-0">{report.summary}</p>
            </div>
            <div className="stagger">
              {report.dimensions.map((d) => (
                <div key={d.key} className="jn-card p-4 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h3 className="h6 fw-bold mb-0">
                      {d.label}
                      {report.top_traits.includes(d.key) && <span className="badge text-bg-warning ms-2">Top trait</span>}
                    </h3>
                    <span className={`badge text-bg-${LEVEL_COLOR[d.level]} text-capitalize`}>{d.level} · {d.score}/100</span>
                  </div>
                  <div className="progress mb-3" style={{ height: 10 }} role="progressbar" aria-label={`${d.label} score`} aria-valuenow={d.score} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-bar" style={{ width: `${d.score}%`, transition: 'width 1s' }} />
                  </div>
                  <p className="mb-1">{d.description}</p>
                  {d.suited_environments && <p className="small text-muted mb-0"><strong>May suit:</strong> {d.suited_environments}</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="col-lg-4">
            <div className="jn-card p-4 mb-4">
              <h2 className="h6 fw-bold">How this is used</h2>
              <p className="small text-muted">
                Employers tag their jobs with culture traits such as "collaborative" or "fast-paced". Your cultural fit for a job is the
                average of your scores on those traits, and it counts for 20% of each job's match score.
              </p>
              <h2 className="h6 fw-bold">How scores are calculated</h2>
              <p className="small text-muted mb-0">
                Each trait has 4 statements. Answers (1–5) are averaged, reverse-worded statements are flipped, and the average is converted to 0–100.
              </p>
            </div>
            <div className="bg-accent-soft rounded-3 p-3 small mb-4">
              <i className="bi bi-info-circle me-1" aria-hidden="true" />{report.disclaimer}
            </div>
            {history.length > 1 && (
              <div className="jn-card p-4">
                <h2 className="h6 fw-bold">Previous results</h2>
                <ul className="list-unstyled mb-0">
                  {history.map((h) => (
                    <li key={h.id} className="py-1">
                      <Link to={`/assessment/report/${h.id}`} className={String(h.id) === String(report.id) ? 'fw-bold' : ''}>
                        {formatDate(h.completed_at)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
