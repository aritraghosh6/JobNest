const { SKILLS, extractSkills, textHasSkill, displaySkill } = require('../data/skills');

/**
 * JobNest ATS compatibility checker — transparent, rule-based scoring.
 * This estimates how well a resume's text lines up with a job description.
 * It is NOT the result of any commercial Applicant Tracking System.
 *
 * Components (weights are re-normalised over the components that apply):
 *   skills      40  required skills (from the job's skill list or detected in the description) found in the resume
 *   keywords    25  coverage of the 15 most frequent meaningful words in the job description
 *   experience  15  detected years of experience vs. years asked for (only if the description asks)
 *   education   10  a degree mentioned in the resume (only if the description mentions a degree)
 *   structure   10  contact details, standard section headings and a sensible length
 *
 * overall = round( sum(score_i * weight_i) / sum(weight_i) ) over applicable components, 0-100.
 */

const WEIGHTS = { skills: 40, keywords: 25, experience: 15, education: 10, structure: 10 };
const KEYWORD_COUNT = 15;

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both
  but by can could did do does doing down during each etc few for from further had has have having he her here hers
  him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours
  out over own same she should so some such than that the their them then there these they this those through to too
  under until up very was we were what when where which while who whom why will with would you your yours
  able ability abilities across additional along apply applicant applicants based best candidate candidates company
  day days degree desired develop developing duties environment equivalent excellent experience experienced familiarity
  good great help highly ideal including job join knowledge least level looking make must new needed opportunity
  plus position preferred proven qualification qualifications related relevant required requirement requirements
  responsibilities responsible role roles salary skill skills strong team teams understanding use using want well
  within work working year years yrs month months per across various ensure etc within like get one two three`
    .split(/\s+/)
    .filter(Boolean)
);

const DEGREE_RE =
  /\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|bca|mca|m\.?\s?tech|m\.?\s?sc|mba|ph\.?\s?d|diploma|bachelor'?s?|master'?s?|degree|graduate|graduation)\b/i;

const SECTION_CHECKS = [
  { key: 'experience', label: 'Experience section', re: /\b(experience|work history|employment|internships?)\b/i },
  { key: 'education', label: 'Education section', re: /\beducation\b|\bacademic/i },
  { key: 'skills', label: 'Skills section', re: /\b(skills|technical skills|competencies)\b/i },
  { key: 'projects', label: 'Projects or achievements section', re: /\b(projects?|achievements?|accomplishments?)\b/i },
];

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter(Boolean);

const stem = (word) => (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

/** The most frequent meaningful words in the job description (excluding skills, scored separately). */
function topKeywords(jobText, skillNames) {
  const skillWords = new Set(skillNames.flatMap((s) => tokenize([s, ...(SKILLS[s] || [])].join(' '))));
  const counts = new Map();
  const firstSeen = new Map();
  tokenize(jobText).forEach((token, index) => {
    if (token.length < 3 || /^\d/.test(token) || STOPWORDS.has(token) || skillWords.has(token)) return;
    const key = stem(token);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!firstSeen.has(key)) firstSeen.set(key, index);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0]) - firstSeen.get(b[0]))
    .slice(0, KEYWORD_COUNT)
    .map(([word]) => word);
}

/** Smallest "N years" requirement in the job description, or null. */
function requiredYears(jobText) {
  const re = /(\d{1,2})\s*\+?\s*(?:(?:-|to)\s*\d{1,2}\s*)?(?:years?|yrs?)/gi;
  const found = [];
  let m;
  while ((m = re.exec(jobText))) {
    const n = Number(m[1]);
    if (n > 0 && n <= 30) found.push(n);
  }
  return found.length ? Math.min(...found) : null;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/**
 * Detects years of experience in the resume:
 *  1. an explicit statement such as "3+ years of experience", otherwise
 *  2. the total of date ranges such as "Jan 2021 - Mar 2023" or "2019 – Present" (overlaps merged).
 * Returns null if nothing reliable is found.
 */
function detectedYears(resumeText) {
  const explicit = [...resumeText.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){0,2}experience/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n <= 40);
  if (explicit.length) return Math.max(...explicit);

  const now = new Date();
  const monthPart = '(?:(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?\\s+)?';
  const rangeRe = new RegExp(
    `${monthPart}((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:${monthPart}((?:19|20)\\d{2})|(present|current|now|till date))`,
    'gi'
  );
  // Ignore lines about education (e.g. "B.Tech, 2020 - 2024") so study years are not counted as work
  const workText = resumeText
    .split(/\n/)
    .filter((line) => !DEGREE_RE.test(line) && !/universit|college|institute|school|cgpa|gpa/i.test(line))
    .join('\n');
  const intervals = [];
  for (const m of workText.matchAll(rangeRe)) {
    const start = new Date(Number(m[2]), m[1] ? MONTHS[m[1].toLowerCase().slice(0, 3)] : 0, 1);
    const end = m[5]
      ? now
      : new Date(Number(m[4]), m[3] ? MONTHS[m[3].toLowerCase().slice(0, 3)] : 11, 28);
    if (end > start && end <= now && start.getFullYear() > 1980) intervals.push([start.getTime(), end.getTime()]);
  }
  if (!intervals.length) return null;
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (const [s, e] of intervals.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e);
    else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return Math.round((total / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
}

function structureCheck(resumeText, wordCount) {
  const checks = [
    { label: 'Email address', ok: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(resumeText) },
    { label: 'Phone number', ok: /(\+?\d[\d\s-]{8,}\d)/.test(resumeText) },
    ...SECTION_CHECKS.map((s) => ({ label: s.label, ok: s.re.test(resumeText) })),
    { label: 'Length between 200 and 1200 words', ok: wordCount >= 200 && wordCount <= 1200 },
  ];
  const passed = checks.filter((c) => c.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}

/**
 * Analyses resume text against a job.
 * @param {string} resumeText  extracted resume text
 * @param {number} wordCount
 * @param {{ description: string, skills?: string[], title?: string }} job
 */
function analyzeResume(resumeText, wordCount, job) {
  const jobText = `${job.title || ''}\n${job.description || ''}\n${job.qualifications || ''}`;

  // Required skills: the employer's explicit list when available, plus skills detected in the description
  const skills = [...new Set([...(job.skills || []).map(displaySkill), ...extractSkills(jobText)])];
  const matchedSkills = skills.filter((s) => textHasSkill(resumeText, s));
  const missingSkills = skills.filter((s) => !matchedSkills.includes(s));

  const keywords = topKeywords(jobText, skills);
  const resumeTokens = new Set(tokenize(resumeText).map(stem));
  const keywordsFound = keywords.filter((k) => resumeTokens.has(k));
  const keywordsMissing = keywords.filter((k) => !resumeTokens.has(k));

  const reqYears = typeof job.experience_min === 'number' && job.experience_min > 0 ? job.experience_min : requiredYears(jobText);
  const detYears = detectedYears(resumeText);

  const jobNeedsDegree = DEGREE_RE.test(jobText);
  const resumeHasDegree = DEGREE_RE.test(resumeText);

  const structure = structureCheck(resumeText, wordCount);

  const components = [
    {
      key: 'skills',
      label: 'Skills match',
      applicable: skills.length > 0,
      score: skills.length ? Math.round((matchedSkills.length / skills.length) * 100) : 0,
      details: skills.length
        ? `${matchedSkills.length} of ${skills.length} required skills found in your resume.`
        : 'No recognised skills were found in the job description.',
    },
    {
      key: 'keywords',
      label: 'Keyword coverage',
      applicable: keywords.length >= 5,
      score: keywords.length ? Math.round((keywordsFound.length / keywords.length) * 100) : 0,
      details: `${keywordsFound.length} of the ${keywords.length} most frequent job-description terms appear in your resume.`,
    },
    {
      key: 'experience',
      label: 'Experience',
      applicable: reqYears !== null,
      score: reqYears ? Math.round(Math.min((detYears || 0) / reqYears, 1) * 100) : 0,
      details:
        reqYears === null
          ? 'The job description does not state a number of years, so this was not scored.'
          : detYears === null
            ? `The job asks for about ${reqYears} year(s). We could not detect a duration in your resume.`
            : `The job asks for about ${reqYears} year(s); we detected about ${detYears} year(s) in your resume.`,
    },
    {
      key: 'education',
      label: 'Education',
      applicable: jobNeedsDegree,
      score: resumeHasDegree ? 100 : 0,
      details: !jobNeedsDegree
        ? 'The job description does not mention a degree, so this was not scored.'
        : resumeHasDegree
          ? 'Your resume mentions a degree or qualification.'
          : 'The job mentions a degree, but we could not find one in your resume.',
    },
    {
      key: 'structure',
      label: 'Resume structure',
      applicable: true,
      score: structure.score,
      details: `Passed ${structure.checks.filter((c) => c.ok).length} of ${structure.checks.length} checks: ` +
        structure.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}`).join(', ') + '.',
    },
  ].map((c) => ({ ...c, weight: WEIGHTS[c.key] }));

  const applicable = components.filter((c) => c.applicable);
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  const overall = Math.round(applicable.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight);

  return {
    overall_score: Math.max(0, Math.min(100, overall)),
    breakdown: components,
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    keywords_found: keywordsFound,
    keywords_missing: keywordsMissing,
    experience: { required_years: reqYears, detected_years: detYears },
    recommendations: buildRecommendations({
      overall,
      missingSkills,
      keywordsMissing,
      reqYears,
      detYears,
      jobNeedsDegree,
      resumeHasDegree,
      structure,
      wordCount,
      resumeText,
    }),
  };
}

function buildRecommendations(r) {
  const recs = [];
  if (r.missingSkills.length) {
    recs.push(
      `The job asks for ${r.missingSkills.slice(0, 8).join(', ')}, which we could not find in your resume. ` +
        'If you genuinely have these skills, name them in your skills section and show where you used them. ' +
        'Do not add skills you do not have.'
    );
  }
  if (r.keywordsMissing.length) {
    recs.push(
      `These job-description terms are missing: ${r.keywordsMissing.slice(0, 8).join(', ')}. ` +
        'Where they honestly describe your work, use the same wording in your experience or project descriptions.'
    );
  }
  if (r.reqYears !== null && r.detYears === null) {
    recs.push('Add start and end dates to each role, internship or project (for example "Jan 2023 – Jun 2024") so your experience can be read.');
  } else if (r.reqYears !== null && r.detYears < r.reqYears) {
    recs.push(
      `The job asks for about ${r.reqYears} year(s) of experience and we detected about ${r.detYears}. ` +
        'Highlight relevant internships and projects, but describe your experience accurately.'
    );
  }
  if (r.jobNeedsDegree && !r.resumeHasDegree) {
    recs.push('The job mentions a degree. If you have one, list it clearly in an "Education" section with the institution and year.');
  }
  for (const check of r.structure.checks.filter((c) => !c.ok)) {
    if (check.label === 'Email address' || check.label === 'Phone number') {
      recs.push(`Add your ${check.label.toLowerCase()} near the top of the resume.`);
    } else if (check.label.startsWith('Length')) {
      recs.push(
        r.wordCount < 200
          ? 'Your resume is quite short. Add brief descriptions of what you did and achieved in each role or project.'
          : 'Your resume is long. Keep the most relevant experience and shorten older or unrelated details.'
      );
    } else {
      recs.push(`Add a clearly labelled "${check.label.replace(' section', '').replace(' or achievements', '')}" heading so ATS software can find that information.`);
    }
  }
  const numbers = (r.resumeText.match(/\d+\s?%|\b\d{2,}\b/g) || []).length;
  if (numbers < 3) {
    recs.push('Where accurate, add measurable results (for example "reduced report time by 30%").');
  }
  recs.push('Use simple formatting (standard headings, no text inside images or tables) so ATS software can read every section.');
  if (r.overall >= 80) {
    recs.unshift('Your resume is closely aligned with this job description. Review the remaining points before applying.');
  }
  return recs;
}

module.exports = { analyzeResume, WEIGHTS, requiredYears, detectedYears, topKeywords };
