# JobNest — MERN Recruitment and Career Platform

JobNest connects **job seekers** and **employers** in the energy, utilities and services industry.
It matches people to jobs by skills, preferences and cultural fit, and explains every score.

| Layer    | Technology                                                                 |
|----------|----------------------------------------------------------------------------|
| Frontend | React 18 (Create React App), React Router 6, Axios, Bootstrap 5, Bootstrap Icons |
| Backend  | Node.js, Express 4 (Express Generator layout), JWT, bcryptjs, Multer       |
| Database | MongoDB with Mongoose (`JobNestDB`)                                        |
| Files    | pdf-parse and mammoth (resume text), Nodemailer (confirmation emails)      |

---

## 1. What is implemented

| # | User story (from the Jobnest PDF) | Where |
|---|---|---|
| 1 | Job seeker profile: name, email, password, preferences, skills, education, experience, social links, **resume and cover letter upload**; **one email can have one job seeker account and one employer account** (chosen at login); an email deactivated by the admin can't log in or register again | `/profile` · `POST/PUT /profiles` · `/profiles/me/documents/:type` |
| 2 | **Personality assessment** (20 questions, cannot be skipped) and cultural-fit report | `/assessment` · `/assessments/*` |
| 3 | Only **matching** jobs shown, **sorted by relevance**, with search, filters and explanations | `/jobs` · `GET /jobs` |
| 4 | Apply only to matching jobs, duplicate prevention, **confirmation email**, application tracking, withdraw | `/jobs/:id` · `POST /jobs/:jobId/apply` · `/applications` |
| 5 | Employer profile: company name, culture, values, **logo upload**, verification documents; a job seeker's email can also register as an employer, and joining a company is still verified (auto-approved only for a matching company email domain, otherwise by the admin) | `/company` · `/profiles/me/logo` · `/profiles/me/verification` |
| 6 | Job postings with title, description, required skills, salary range; edit, close/reopen, delete, applicant review | `/employer/jobs` · `/jobs` |
| 7 | **Connect** with users and **send/receive messages** (connections only) | `/network` · `/messages` · `/connections` · `/messages` |
| + | **Resume ATS Score Checker** (PDF/DOCX, transparent 0–100 score, matched/missing skills, recommendations, history) | `/ats-checker` · `/resumes/*` |
| + | **Admin**: employer verification, user activation/deactivation, job moderation, statistics | `/admin` · `/admin/*` |

Also included: role-based access on every API route, validation on both sides, consistent JSON errors,
responsive layout, keyboard focus styles, skip link, ARIA labels, and animations that switch off for
users who prefer reduced motion.

---

## 2. Folder structure

```
Jobnest_Team1/
├── .gitignore
├── README.md
├── docs/TEAM_PLAN.md            ← team split, 6-day schedule, Git workflow, API contract
├── docs/DATABASE.md             ← database setup and full collection reference
├── backend/
│   ├── bin/www                  ← starts the server after MongoDB connects
│   ├── app.js                   ← loads .env, middleware, mounts /api/v1
│   ├── .env.example             ← copy to .env
│   ├── config/                  ← db.js (single connection), env.js, constants.js
│   ├── models/                  ← User, SeekerProfile, EmployerProfile, Job, Application,
│   │                              Assessment, Connection, Message, ResumeAnalysis
│   ├── controllers/             ← request handlers per feature
│   ├── routes/                  ← URL → controller mapping (index.js mounts all)
│   ├── middleware/              ← auth (JWT + roles), upload (Multer), error handler
│   ├── services/                ← matching, assessment scoring, ATS, text extraction, email
│   ├── data/                    ← assessment questions, skill dictionary
│   ├── utils/                   ← AppError, asyncHandler, validators, file helpers
│   ├── scripts/dbInit.js        ← creates empty collections + indexes (npm run db:init)
│   ├── scripts/createAdmin.js   ← creates the admin account
│   └── uploads/                 ← private uploaded files (git-ignored)
└── frontend/
    ├── public/index.html
    └── src/
        ├── index.js, App.js     ← entry point and routes
        ├── api/                 ← client.js (Axios + JWT), services.js (every endpoint)
        ├── context/AuthContext.js
        ├── components/          ← navbar, protected route, alerts, score ring, tag input…
        ├── pages/               ← auth, seeker, assessment, jobs, applications,
        │                          network, ats, employer, admin
        ├── utils/helpers.js     ← labels and formatting
        └── styles/theme.css     ← single colour theme + animations
```

**How a request flows:** a React page calls a function in `src/api/services.js` → Axios adds the
JWT and sends it to `http://localhost:5000/api/v1/...` → `routes/*.js` checks login and role
(`middleware/auth.js`) → a controller validates input and uses Mongoose models → MongoDB →
JSON comes back → the page shows the result or the error message.

---

## 3. Setup on Windows (PowerShell)

### 3.1 Requirements
- Node.js 18 or 20 LTS (`node -v`)
- MongoDB Community Server running locally **or** a MongoDB Atlas connection string
- Git

### 3.2 Replace the old generated files
This project replaces the Express Generator demo files (Jade views and the sample `routes/index.js`
and `routes/users.js`) with the JobNest API. The `views` folder and `public` folder in `backend`
are no longer used and can be deleted. Keep your own `backend/.env`.

### 3.3 Backend
```powershell
cd backend
npm install
Copy-Item .env.example .env      # skip if you already have a .env
notepad .env                     # set MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```
Generate a strong JWT secret and paste it into `.env`:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Create the administrator (admins cannot sign up publicly):
```powershell
npm run create-admin
```
Start the API:
```powershell
npm run dev      # restarts on file changes (or: npm start)
```
You should see `MongoDB connected: 127.0.0.1/JobNestDB` and
`JobNest API running at http://localhost:5000/api/v1`.

### 3.4 Frontend (new terminal)
```powershell
cd frontend
npm install
npm start
```
The app opens at http://localhost:3000. If your API runs elsewhere, copy `frontend/.env.example`
to `frontend/.env` and change `REACT_APP_API_URL`, then restart `npm start`.

### 3.5 MongoDB options
- **Local (each teammate):** keep `MONGO_URI=mongodb://127.0.0.1:27017/JobNestDB`. Every person has
  their own data.
- **Shared Atlas cluster:** one person creates a free cluster, adds a database user and the team's IP
  addresses, then shares the URI privately (never in Git), e.g.
  `MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/JobNestDB`.

See **section 3.7** and **docs/DATABASE.md** for the full database setup and verification steps.

### 3.6 Confirmation emails (US4)
Without SMTP settings, emails are **printed in the backend terminal** (marked "Email not sent") and the
UI says so. To send real emails, fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `.env`
(for Gmail, use an App Password).

### 3.7 Database (no sample data)

`JobNestDB` starts **empty**. All records come from real use of the app. **docs/DATABASE.md** covers:
- why the database may not be visible (installed vs. running vs. connected vs. created)
- Windows install and start commands
- every collection with its fields, rules and indexes
- Compass and mongosh checks

Quick version:
```powershell
Get-Service MongoDB              # must be Running (Start-Service MongoDB as Administrator)
cd backend
npm install
npm run db:init                  # creates the 9 empty collections + indexes, inserts nothing
npm run create-admin             # optional now; creates only your real admin from .env
npm run dev                      # also checks collections/indexes on every start
```
Collections: `users`, `jobseekerprofiles`, `employerprofiles`, `jobs`, `applications`,
`assessmentresults`, `connections`, `messages`, `atsanalyses`.

Compass: connect to `mongodb://127.0.0.1:27017` → `JobNestDB`.
mongosh: `mongosh "mongodb://127.0.0.1:27017"` → `show dbs` → `use JobNestDB` → `show collections`.

---

## 4. Demo walkthrough (test plan)

1. **Employer:** Register → choose *Employer* → create company profile (tick culture traits) → upload a
   logo → submit verification (registration number + PDF). *Post a job* stays disabled.
2. **Admin:** Log in with the `ADMIN_EMAIL` account → Admin panel → *Employer verification* → open the
   document → Approve. (Try Reject without a note to see validation.)
3. **Employer:** Post a job with required skills, salary range and culture traits. Try a salary max below
   the min, or a past deadline, to see validation.
4. **Job seeker:** Register → create profile with skills that overlap the job → upload a resume.
   Open *Jobs*: you are asked to complete the assessment first (US2: cannot skip).
5. Take the assessment; try *Next* without answering to see the block. View the report.
6. *Jobs* now lists only matching jobs, sorted by relevance, with reasons. Search and filter.
7. Apply with a short cover letter → success message + email (terminal) → applying again is blocked.
8. *Applications* shows the status timeline. Employer → *Applicants* → download resume → move to
   *Shortlisted* → *Interview*. Seeker sees the new status. Seeker can withdraw.
9. *ATS Checker*: upload a PDF and a DOCX resume, pick the job or paste a description. Try a `.txt`
   file, a file over 2 MB and a scanned/empty PDF to see the error messages.
10. *Network*: seeker sends a connection request to the employer → employer accepts → both exchange
    messages. Messaging someone who is not a connection is rejected by the API.
11. **Security checks:** open `/admin` as a seeker (redirected), call `GET /api/v1/admin/stats` with a
    seeker token in Postman (403), call any route without a token (401), deactivate a user and try
    logging in as them (403).

### Testing the API with Postman / Thunder Client
1. `POST http://localhost:5000/api/v1/auth/login` with JSON `{ "email": "...", "password": "..." }`.
2. Copy `token` from the response.
3. Add header `Authorization: Bearer <token>` to other requests, e.g. `GET /api/v1/jobs`.
4. File uploads use *form-data* with the field names `file` (seeker documents), `logo`,
   `document` (verification) and `resume` (ATS).

---

## 5. Scoring methods (shown in the app too)

**Job match (0–100)** = Skills 60% (share of required skills in your profile) + Preferences 20%
(location, job type, desired role) + Culture fit 20% (your assessment scores on the job's culture
traits; neutral 50 if the job has none). A job is shown only if at least one required skill matches
and the score is at least 40. This is a transparent rule-based method, not AI.

**Assessment:** 20 statements, 4 per trait (Collaboration, Structure, Innovation, Pace, Autonomy).
Answers 1–5, reverse-worded statements flipped, averaged, converted to 0–100. Indicative only — not a
validated psychometric test.

**ATS score (0–100):** Skills 40, Keywords 25, Experience 15, Education 10, Structure 10. Experience and
education are only scored if the job description asks for them; weights are re-normalised over the
components that apply. Resume files are processed in memory and not stored. Not the output of any
commercial ATS.

---

## 6. Common errors

| Message | Cause and fix |
|---|---|
| `MongoDB connection failed` | MongoDB service is not running (`services.msc` → MongoDB Server → Start) or `MONGO_URI` is wrong. |
| `Missing environment variable(s): JWT_SECRET` | `backend/.env` is missing or in the wrong folder. It must be next to `app.js`. |
| `Port 5000 is already in use` | Another backend is running. Close it or change `PORT` (and `REACT_APP_API_URL`). |
| Frontend shows "Cannot reach the JobNest server" | Backend is not running, or CORS: `CLIENT_URL` must be `http://localhost:3000`. |
| `npm ERR! ERESOLVE` on frontend install | Run `npm install --legacy-peer-deps`. |
| ATS says "could only read N words" | The PDF is a scanned image. Export a text-based PDF or use DOCX. |

## 7. Known limitations
- Messaging refreshes every 5 seconds (polling) instead of real-time sockets.
- Skill detection in the ATS checker uses a dictionary (`backend/data/skills.js`); add domain skills
  there if your jobs use terms it does not recognise.
- Uploaded files are stored on the server's disk (`backend/uploads`), which suits a project demo.
