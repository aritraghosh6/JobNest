# JobNest — Team Plan, Schedule, Git Workflow and API Contract

## 1. Ownership (6 members)

Each member owns one module end to end: they must understand every file in it, test it, fix its bugs,
improve it, and present it in the demo. Shared files (`app.js`, `routes/index.js`, `App.js`,
`AppNavbar.js`, `theme.css`, `constants.js`) are changed only after telling Member 1.

| Member | Module | Backend files | Frontend files |
|---|---|---|---|
| 1 — Lead | Auth, seeker profile and documents (US1), integration, README | `app.js`, `bin/www`, `config/*`, `middleware/*`, `utils/*`, `models/User.js`, `models/SeekerProfile.js`, `controllers/authController.js`, `controllers/profileController.js` (seeker parts), `routes/auth.js`, `routes/profiles.js` | `App.js`, `index.js`, `api/*`, `context/AuthContext.js`, `components/*`, `pages/auth/*`, `pages/seeker/*`, `pages/Dashboard.js`, `pages/Landing.js` |
| 2 | Personality assessment and report (US2) | `models/Assessment.js`, `data/assessmentQuestions.js`, `services/assessmentService.js`, `controllers/assessmentController.js`, `routes/assessments.js` | `pages/assessment/*` |
| 3 | Job matching and applications (US3, US4) | `services/matchingService.js`, `services/seekerContext.js`, `services/mailService.js`, `models/Application.js`, `controllers/applicationController.js`, `jobController.js` (getMatchedJobs, getJobById, applyForJob), `routes/applications.js` | `pages/jobs/*`, `pages/applications/*` |
| 4 | Employer profile, culture, verification (US5) + admin verification | `models/EmployerProfile.js`, `profileController.js` (employer parts), `controllers/adminController.js` (verification and users), `routes/admin.js`, `scripts/createAdmin.js` | `pages/employer/CompanyProfilePage.js`, `pages/admin/AdminDashboard.js` |
| 5 | Job posting and management (US6) + admin job moderation | `models/Job.js`, `jobController.js` (create, update, status, delete, applicants), `routes/jobs.js`, `adminController.js` (jobs) | `pages/employer/EmployerJobsPage.js`, `JobFormPage.js`, `JobApplicantsPage.js` |
| 6 | Networking, messaging (US7) and ATS checker | `models/Connection.js`, `Message.js`, `ResumeAnalysis.js`, `services/userCards.js`, `services/atsService.js`, `services/textExtractor.js`, `data/skills.js`, `controllers/networkController.js`, `messageController.js`, `resumeController.js`, `routes/users.js`, `connections.js`, `messages.js`, `resumes.js` | `pages/network/*`, `pages/ats/*` |

Dependencies between modules: everyone needs Member 1's auth (already in place). Member 3's matching
uses Member 2's assessment scores and Member 5's job fields. Member 5's posting depends on Member 4's
verification. Keep field names exactly as in section 4.

## 2. Six-day schedule

| Day | Everyone | Deliverable |
|---|---|---|
| 1 | Lead pushes the base project to `main`. Everyone clones, installs, runs it locally, creates their branch, reads their module's files and runs its demo steps from the README. | App runs on every laptop; first commit per member (e.g. notes, small fix, extra validation message). |
| 2 | Backend: test every endpoint of your module in Postman, including failure cases (missing fields, wrong role, invalid id). Fix anything that fails. | Postman collection per module; backend fixes pushed. |
| 3 | Frontend: walk through every screen of your module on desktop and phone width. Fix layout, wording and validation messages. | UI fixes pushed. |
| 4 | Finish remaining acceptance criteria, edge cases and improvements (e.g. more assessment wording, more skills in the dictionary, better empty states). | Modules functionally complete. |
| 5 | Lead merges all branches; whole team runs the full demo walkthrough on the merged `main`, then fixes integration bugs. | Integrated app, no blocking bugs. |
| 6 | Regression test, accessibility check (keyboard only, screen zoom 200%), spelling check, README update, demo rehearsal. | Stable demo build. |

Rule from the brief: at least one meaningful push per member per day.

## 3. Git workflow (PowerShell)

**Member 1, once:**
```powershell
cd C:\path\to\Jobnest_Team1
git init                                   # skip if already a repo
git add .
git status                                 # check: no node_modules, no .env
git commit -m "JobNest base project"
git branch -M main
git remote add origin <REPOSITORY_URL>
git push -u origin main
```

**Every member, once:**
```powershell
git clone <REPOSITORY_URL>
cd Jobnest_Team1
git checkout -b feature/seeker-profile     # use your branch name
git push -u origin feature/seeker-profile
```
Branch names: `feature/seeker-profile`, `feature/personality-assessment`,
`feature/job-matching-applications`, `feature/employer-profile`, `feature/job-posting`,
`feature/networking-ats`.

**Daily:**
```powershell
git pull origin main                       # get the latest integrated code
# ...work...
git add .
git commit -m "Assessment: show unanswered question numbers"
git push
```

**Member 1, merging:**
```powershell
git checkout main
git pull
git merge origin/feature/personality-assessment
# fix conflicts if any, then:
git push
```
If `git` cannot resolve the server name, connect to the company VPN first.

## 4. API contract (base URL `http://localhost:5000/api/v1`)

All responses are JSON. Errors are always `{ "error": "message", "details": { ... } }`.
Auth column: — = public, 🔒 = token required. Header: `Authorization: Bearer <token>`.

| Method | URL | Auth / roles | Body or query | Success |
|---|---|---|---|---|
| POST | `/auth/signup` | — | `name, email, password, role` (`job_seeker`/`employer`) | 201 `{ message, token, user }` |
| POST | `/auth/login` | — | `email, password` | 200 `{ token, user }` · 401 `Invalid credentials` |
| GET | `/auth/me` | 🔒 any | — | `{ user }` |
| GET | `/profiles/me` | 🔒 seeker, employer | — | `{ profile }` or `{ profile: null }` |
| POST | `/profiles` | 🔒 seeker, employer | seeker: `full_name, location, skills[], job_preferences{desired_roles[], job_types[], preferred_locations[], expected_salary, open_to_remote}, education[], experience[], social_links{}`; employer: `company_name, industry, location, company_description, culture_description, values[], culture_tags[], job_preferences{required_skills[], salary_range}` | 201 `{ message, profile }` |
| PUT | `/profiles/me` | 🔒 seeker, employer | same as POST | `{ message, profile }` |
| POST/GET/DELETE | `/profiles/me/documents/:type` | 🔒 seeker | `type` = `resume`/`cover_letter`; form-data `file` (PDF/DOCX ≤ 2 MB) | `{ message, profile }` / file download |
| POST | `/profiles/me/logo` | 🔒 employer | form-data `logo` (PNG/JPG/WEBP ≤ 1 MB) | `{ message, profile }` |
| POST | `/profiles/me/verification` | 🔒 employer | form-data `registration_number`, `document` (PDF/PNG/JPG ≤ 5 MB) | `{ message, profile }` |
| GET | `/profiles/companies/:userId` | 🔒 any | — | `{ profile }` (public fields) |
| GET | `/assessments/questions` | 🔒 seeker | — | `{ instructions, scale, questions }` |
| POST | `/assessments/submit` | 🔒 seeker | `answers: [{ question_id, value 1-5 }]` (all 20) | 201 `{ report }` |
| GET | `/assessments/latest`, `/assessments/history`, `/assessments/:id` | 🔒 seeker | — | `{ report }` / `{ history }` |
| GET | `/jobs` | 🔒 seeker | `q, location, employment_type, min_salary, sort (relevance/newest/salary), page, limit` | `{ jobs[{...job, match, has_applied}], total, page, pages }` |
| GET | `/jobs/mine` | 🔒 employer | — | `{ jobs[{...job, application_count}] }` |
| GET | `/jobs/:id` | 🔒 any | — | `{ job }` (+ `match`, `my_application`, `can_apply` for seekers) |
| POST | `/jobs` | 🔒 verified employer | `title, description, skills_required[], qualifications, experience_min, location, employment_type, is_remote, salary_min, salary_max, culture_tags[], application_deadline` | 201 `{ message, job }` |
| PUT | `/jobs/:id` | 🔒 owner employer | same as POST | `{ message, job }` |
| PATCH | `/jobs/:id/status` | 🔒 owner employer | `status: open/closed` | `{ message, job }` |
| DELETE | `/jobs/:id` | 🔒 owner employer | — (only with no applications) | `{ message }` |
| POST | `/jobs/:jobId/apply` | 🔒 seeker | `cover_letter_text?` | 200 `{ message, email_status, application }` |
| GET | `/jobs/:jobId/applications` | 🔒 owner employer | — | `{ job, applications[] }` |
| GET | `/applications/mine` | 🔒 seeker | `status?` | `{ applications[] }` |
| GET | `/applications/:id` | 🔒 applicant or employer | — | `{ application }` |
| GET | `/applications/:id/resume` | 🔒 applicant or employer | — | file download |
| PATCH | `/applications/:id/status` | 🔒 employer | `status, note?` (allowed transitions only) | `{ message, application }` |
| PATCH | `/applications/:id/withdraw` | 🔒 applicant | — | `{ message, application }` |
| GET | `/users/discover` | 🔒 seeker, employer | `q?, role?` | `{ users[{..., connection}] }` |
| GET | `/connections` | 🔒 seeker, employer | — | `{ connections, incoming, outgoing }` |
| POST | `/connections` | 🔒 seeker, employer | `user_id` | 200 `{ message: "Connection request sent successfully" }` |
| PATCH | `/connections/:id` | 🔒 recipient | `action: accept/reject` | `{ message }` |
| DELETE | `/connections/:id` | 🔒 either user | — | `{ message }` |
| POST | `/messages` | 🔒 connected users | `recipient_id, message` | 200 `{ message: "Message sent successfully", data }` |
| GET | `/messages/conversations`, `/messages/unread-count`, `/messages/:userId` | 🔒 seeker, employer | — | conversations / `{ unread }` / thread |
| POST | `/resumes/analyze` | 🔒 seeker | form-data `resume` + (`job_id` or `job_description`, `job_title?`) | 201 `{ analysis, scoring_method }` |
| GET/DELETE | `/resumes/history`, `/resumes/history/:id` | 🔒 seeker (own only) | — | `{ history }` / `{ analysis }` |
| GET | `/admin/stats` | 🔒 admin | — | `{ stats }` |
| GET / PATCH | `/admin/users`, `/admin/users/:id/status` | 🔒 admin | `q?, role?` / `is_active` | `{ users }` / `{ message, user }` |
| GET / PATCH / GET | `/admin/employers`, `/admin/employers/:id/verification`, `/admin/employers/:id/document` | 🔒 admin | `status?` / `status: approved/rejected, note` | `{ employers }` / `{ message, employer }` / file |
| GET / PATCH | `/admin/jobs`, `/admin/jobs/:id/moderation` | 🔒 admin | `moderation_status?` / `moderation_status: active/removed, note` | `{ jobs }` / `{ message, job }` |

Status codes: 400 validation, 401 not logged in / bad token, 403 wrong role or not allowed,
404 not found, 409 duplicate or conflicting state, 413 file too large, 422 unreadable resume, 500 server.

### Differences from the original API document (and why)
- Port is **5000**, not 3000, because React's dev server uses 3000. The `/api/v1` paths are unchanged.
- Sign-up and profile creation are separate steps (`/auth/signup` then `POST /profiles`), so a password
  is never sent with profile data.
- Sign-up also returns a token, so the user is logged in immediately.
- Application statuses: `submitted → under_review → shortlisted → interview → hired`, plus `rejected`
  and `withdrawn`.
