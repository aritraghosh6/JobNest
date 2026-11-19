/**
 * Skill dictionary shared by job matching and the ATS checker.
 * Each entry: canonical display name -> list of aliases (lowercase).
 * Add new skills here; both features pick them up automatically.
 */
const SKILLS = {
  // Programming languages
  JavaScript: ['javascript', 'js', 'es6', 'ecmascript'],
  TypeScript: ['typescript'],
  Python: ['python'],
  Java: ['java'],
  'C++': ['c++', 'cpp'],
  'C#': ['c#', 'csharp'],
  C: ['c programming', 'c language'],
  Go: ['golang', 'go language'],
  Kotlin: ['kotlin'],
  Swift: ['swift'],
  PHP: ['php'],
  Ruby: ['ruby'],
  Rust: ['rust'],
  Scala: ['scala'],
  MATLAB: ['matlab'],
  R: ['r programming', 'r language'],
  SQL: ['sql'],
  Bash: ['bash', 'shell scripting'],
  // Web
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  React: ['react', 'react.js', 'reactjs'],
  'React Native': ['react native'],
  Angular: ['angular', 'angularjs'],
  'Vue.js': ['vue', 'vue.js', 'vuejs'],
  'Next.js': ['next.js', 'nextjs'],
  Redux: ['redux'],
  Bootstrap: ['bootstrap'],
  'Tailwind CSS': ['tailwind', 'tailwind css', 'tailwindcss'],
  'Node.js': ['node', 'node.js', 'nodejs'],
  'Express.js': ['express', 'express.js', 'expressjs'],
  Django: ['django'],
  Flask: ['flask'],
  FastAPI: ['fastapi'],
  'Spring Boot': ['spring boot', 'springboot', 'spring framework'],
  '.NET': ['.net', 'dotnet', 'asp.net'],
  'REST API': ['rest api', 'restful', 'restful api', 'rest apis'],
  GraphQL: ['graphql'],
  JWT: ['jwt', 'json web token'],
  // Data
  MongoDB: ['mongodb', 'mongo', 'mongoose'],
  MySQL: ['mysql'],
  PostgreSQL: ['postgresql', 'postgres'],
  Oracle: ['oracle', 'oracle db'],
  Redis: ['redis'],
  Firebase: ['firebase'],
  'Microsoft Excel': ['ms excel', 'microsoft excel', 'advanced excel'],
  'Power BI': ['power bi', 'powerbi'],
  Tableau: ['tableau'],
  Pandas: ['pandas'],
  NumPy: ['numpy'],
  'Machine Learning': ['machine learning', 'ml'],
  'Deep Learning': ['deep learning'],
  TensorFlow: ['tensorflow'],
  PyTorch: ['pytorch'],
  'Data Analysis': ['data analysis', 'data analytics'],
  Statistics: ['statistics', 'statistical analysis'],
  NLP: ['nlp', 'natural language processing'],
  // Cloud & DevOps
  AWS: ['aws', 'amazon web services'],
  Azure: ['azure', 'microsoft azure'],
  GCP: ['gcp', 'google cloud'],
  Docker: ['docker'],
  Kubernetes: ['kubernetes', 'k8s'],
  Jenkins: ['jenkins'],
  'CI/CD': ['ci/cd', 'continuous integration', 'continuous delivery'],
  Git: ['git', 'github', 'gitlab', 'bitbucket'],
  Linux: ['linux', 'unix'],
  Terraform: ['terraform'],
  Microservices: ['microservices', 'microservice'],
  // Testing & practices
  Jest: ['jest'],
  Selenium: ['selenium'],
  'Unit Testing': ['unit testing', 'unit tests'],
  Agile: ['agile', 'scrum', 'kanban'],
  'System Design': ['system design'],
  'Data Structures': ['data structures', 'dsa', 'algorithms'],
  OOP: ['oop', 'object oriented programming', 'object-oriented programming'],
  // Design
  Figma: ['figma'],
  'UI/UX': ['ui/ux', 'ux design', 'ui design', 'user experience'],
  // Energy, utilities and engineering
  SCADA: ['scada'],
  PLC: ['plc', 'plc programming'],
  AutoCAD: ['autocad'],
  ETAP: ['etap'],
  'Power Systems': ['power systems', 'power system'],
  'Renewable Energy': ['renewable energy', 'solar energy', 'wind energy'],
  'Electrical Engineering': ['electrical engineering'],
  'Mechanical Engineering': ['mechanical engineering'],
  'Project Management': ['project management', 'pmp'],
  'Health and Safety': ['hse', 'health and safety', 'safety compliance'],
  SAP: ['sap'],
  'Six Sigma': ['six sigma', 'lean six sigma'],
  // Business and soft skills
  Communication: ['communication', 'communication skills'],
  Leadership: ['leadership', 'team leadership'],
  'Problem Solving': ['problem solving', 'problem-solving'],
  Teamwork: ['teamwork', 'collaboration'],
  'Customer Service': ['customer service', 'customer support'],
  'Time Management': ['time management'],
  Sales: ['sales', 'business development'],
  Marketing: ['marketing', 'digital marketing', 'seo'],
  Accounting: ['accounting', 'bookkeeping'],
};

// alias -> canonical name
const ALIAS_TO_CANONICAL = new Map();
for (const [canonical, aliases] of Object.entries(SKILLS)) {
  ALIAS_TO_CANONICAL.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) ALIAS_TO_CANONICAL.set(alias, canonical);
}
// Typed skill names that are safe to normalise but too ambiguous to search for in free text
const NORMALIZE_ONLY = { excel: 'Microsoft Excel', spring: 'Spring Boot', rest: 'REST API', ts: 'TypeScript' };
for (const [alias, canonical] of Object.entries(NORMALIZE_ONLY)) ALIAS_TO_CANONICAL.set(alias, canonical);

/** Converts a user-typed skill to a comparable key ("ReactJS" and "react" -> "react"). */
function normalizeSkill(skill) {
  const cleaned = String(skill || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const canonical = ALIAS_TO_CANONICAL.get(cleaned);
  return canonical ? canonical.toLowerCase() : cleaned;
}

/** Display name for a skill (canonical if known, otherwise as typed). */
function displaySkill(skill) {
  const cleaned = String(skill || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return ALIAS_TO_CANONICAL.get(cleaned) || String(skill).trim();
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Word-boundary pattern that also works for skills like "c++", "c#" and ".net"
function aliasPattern(alias) {
  return new RegExp(`(?<![a-z0-9+#.])${escapeRegex(alias)}(?![a-z0-9+#])`, 'i');
}

// Short names that are also ordinary words/letters are matched only through their aliases
const MATCH_BY_ALIAS_ONLY = new Set(['C', 'Go', 'R']);

const COMPILED = Object.entries(SKILLS).map(([canonical, aliases]) => ({
  canonical,
  patterns: [
    ...new Set([...(MATCH_BY_ALIAS_ONLY.has(canonical) ? [] : [canonical.toLowerCase()]), ...aliases]),
  ].map(aliasPattern),
}));

/** Finds dictionary skills mentioned in free text. Returns canonical names. */
function extractSkills(text) {
  const lower = String(text || '').toLowerCase();
  return COMPILED.filter(({ patterns }) => patterns.some((p) => p.test(lower))).map((s) => s.canonical);
}

/** True if the text mentions the given skill (dictionary aliases or the literal phrase). */
function textHasSkill(text, skill) {
  const lower = String(text || '').toLowerCase();
  const canonical = displaySkill(skill);
  const entry = COMPILED.find((s) => s.canonical === canonical);
  if (entry) return entry.patterns.some((p) => p.test(lower));
  return aliasPattern(String(skill).toLowerCase().trim()).test(lower);
}

module.exports = { SKILLS, normalizeSkill, displaySkill, extractSkills, textHasSkill, aliasPattern };
