import React, { useEffect, useState } from 'react';

const colorFor = (score) => (score >= 75 ? '#0f766e' : score >= 50 ? '#d97706' : '#dc2626');

/** Circular score (0-100) that animates from 0 to the value. */
export default function ScoreRing({ score = 0, size = 120, stroke = 10, label = 'score' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, shown)) / 100) * circumference;

  return (
    <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorFor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label" aria-hidden="true">
        <div className="ring-number" style={{ fontSize: size / 4, color: colorFor(score) }}>{score}</div>
        <div className="small text-muted">/ 100</div>
      </div>
    </div>
  );
}
