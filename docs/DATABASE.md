# JobNestDB — Database Guide

This guide covers:
1. Why your database might not be visible, and how to fix that on Windows.
2. How the backend creates the empty database.
3. A reference for every collection and its fields.
4. How to check that real records are saved.

The database contains **no sample data**. Every document is created by real users through the app.

---

## 1. Why you cannot see your database yet

These six things are separate steps. Each one must happen before the next.

| # | Stage | What it means | How to check |
|---|---|---|---|
| 1 | **MongoDB installed** | The program files are on your PC. Nothing is running yet. | `mongod --version` (or check *Apps* in Windows Settings). |
| 2 | **MongoDB server started** | The `mongod` service is running and listening on port 27017. | `Get-Service MongoDB` shows *Running*. |
| 3 | **Backend connected** | `npm run dev` connected to the server using `MONGO_URI` from `backend/.env`. | Backend terminal shows `MongoDB connected: 127.0.0.1/JobNestDB`. |
| 4 | **Database created** | MongoDB only creates `JobNestDB` on disk when something is written to it. Before that, the name exists only in your connection string. | `show dbs` lists `JobNestDB`. |
| 5 | **Collections created** | Each collection (e.g. `users`) is created when a document is first saved, or by the JobNest initialiser. | `show collections` lists them. |
| 6 | **Documents inserted** | Real data: a user registers, a job is posted, and so on. | `db.users.countDocuments()` is greater than 0. |

Common reasons the database is "missing":
- The MongoDB service is not running (stage 2).
- `backend/.env` is missing or not in the `backend` folder, so the backend never connected (stage 3).
- Nothing was ever written. **`show dbs` hides databases that hold no data**, and typing
  `use JobNestDB` in mongosh only *switches* to the name; it does not create the database on disk.
- `MONGO_URI` points to a different database name or to an Atlas cluster instead of your local server.

**JobNest fixes stages 4 and 5 for you:** every time the backend starts (and whenever you run
`npm run db:init`), it creates all 9 collections and their indexes. **It inserts no documents.**
Because collections and indexes are written to disk, `JobNestDB` then appears in Compass and in `show dbs`.

---

## 2. Step-by-step setup on Windows

### Step 1 — Install MongoDB
1. Download **MongoDB Community Server** (Windows x64, `.msi`) from https://www.mongodb.com/try/download/community
2. Run the installer → choose *Complete* → tick **Install MongoD as a Service** → keep *Run service as Network Service user* → tick **Install MongoDB Compass**.
3. Optional but recommended: install **mongosh** from https://www.mongodb.com/try/download/shell
   and add its `bin` folder to your PATH if the installer does not.

### Step 2 — Start the MongoDB server
Open PowerShell **as Administrator**:
```powershell
Get-Service MongoDB          # should say Running
Start-Service MongoDB        # only if it says Stopped
```
No service called MongoDB? The installer skipped the service option. Re-run the installer and tick *Install MongoD as a Service*.

### Step 3 — Create `backend/.env`
The file must be in the `backend` folder, next to `app.js`:
```powershell
cd C:\path\to\Jobnest_Team1\backend
Copy-Item .env.example .env
notepad .env
```
Minimum contents:
```env
MONGO_URI=mongodb://127.0.0.1:27017/JobNestDB
PORT=5000
JWT_SECRET=<paste a long random string>
CLIENT_URL=http://localhost:3000
```
Generate the secret with:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Use `127.0.0.1` rather than `localhost`. On some Windows machines, `localhost` resolves to IPv6 and the connection fails.

### Step 4 — Install dependencies and create the empty database
```powershell
npm install
npm run db:init
```
Expected output: a table with 9 collections, each showing `documents: 0`, followed by
`All collections and indexes are ready.`

### Step 5 — Create the administrator account (one real account)
Employers need an admin to verify them. Admins cannot register through the website. Put the real
admin details in `.env` (`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), then run:
```powershell
npm run create-admin
```
This is the only command that writes a document directly, and it writes only the one admin you
configured. You can skip it until you need to verify an employer.

### Step 6 — Start the backend and frontend
```powershell
# terminal 1
cd backend
npm run dev
# terminal 2
cd frontend
npm install
npm start
```
Backend output should include:
```
MongoDB connected: 127.0.0.1/JobNestDB
JobNestDB ready: 9 collections checked
JobNest API running at http://localhost:5000/api/v1
```
If MongoDB is not running, you see `MongoDB connection failed…` and the server stops. It never
runs without a database and never falls back to fake data.

### Step 7 — See the database
**MongoDB Compass:** New connection → URI `mongodb://127.0.0.1:27017` → *Connect* → `JobNestDB`
appears in the left panel with its 9 collections. Click *Refresh* (⟳) if you opened Compass earlier.

**mongosh:**
```powershell
mongosh "mongodb://127.0.0.1:27017"
```
```javascript
show dbs                        // JobNestDB appears after db:init or after the first save
use JobNestDB
show collections
db.getCollectionNames()
db.users.getIndexes()           // shows the unique email index
db.users.countDocuments()       // 0 until someone registers (1 if you created the admin)
```

---

## 3. Collections

All collections use MongoDB's `_id` (ObjectId) and, where noted, Mongoose `timestamps`
(`createdAt`, `updatedAt`). Validation is enforced by Mongoose in the backend before anything is
saved, and controllers add further checks (e.g. password strength, allowed status changes).
Files themselves are stored in `backend/uploads/`. Only file **metadata** is stored in MongoDB.

**Collections not created separately (and why):**
- **Assessment questions** are fixed, versioned content in `backend/data/assessmentQuestions.js`. Only results are stored, in `assessmentresults`.
- **Resumes** are stored as metadata inside `jobseekerprofiles.resume`, with a per-application copy in `applications.resume`. A separate `resumes` collection would duplicate this.
- Resumes uploaded to the ATS checker are analysed in memory and never stored. Only the results go to `atsanalyses`.

**Shared file metadata object** (used by `resume`, `cover_letter`, `logo`, `verification.document`):

| Field | Type | Notes |
|---|---|---|
| `stored_name` | String | Random name on disk (e.g. `3f9c…a1.pdf`); never the user's file name |
| `original_name` | String | Name shown on download, max 150 characters |
| `mimetype` | String | e.g. `application/pdf` |
| `size` | Number | Bytes |
| `uploaded_at` | Date | |

---

### 3.1 `users` — accounts and roles (model `User`)
Purpose: login details for every person. The role decides what they can do.

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | String | ✔ | trimmed, max 100 |
| `email` | String | ✔ | lowercase, valid email format, **unique** |
| `password` | String | ✔ | bcrypt hash (12 rounds); never returned by the API |
| `role` | String | ✔ | `job_seeker` \| `employer` \| `admin` (`admin` cannot come from sign-up) |
| `is_active` | Boolean | | default `true`; deactivated users cannot log in |
| `assessment_completed` | Boolean | | default `false`; set when a seeker submits the assessment |
| `profile_completed` | Boolean | | default `false`; set when a profile is created |
| `createdAt`, `updatedAt` | Date | auto | |

Indexes: `email` unique.

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId,
  "name": "<full name>",
  "email": "<unique email>",
  "password": "<bcrypt hash>",
  "role": "job_seeker",
  "is_active": true,
  "assessment_completed": false,
  "profile_completed": false,
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.2 `jobseekerprofiles` — job seeker profile (model `SeekerProfile`, US1)

| Field | Type | Required | Rules |
|---|---|---|---|
| `user` | ObjectId → `users` | ✔ | **unique**, one profile per user |
| `full_name` | String | ✔ | max 100 |
| `phone` | String | | 7–15 digits, spaces, `-`, optional leading `+` |
| `location` | String | ✔ | max 100 |
| `headline` | String | | max 120 |
| `summary` | String | | max 1500 |
| `skills` | [String] | ✔ | at least 1 |
| `education[]` | Array of objects | | each: `institution` ✔, `degree` ✔, `field_of_study`, `start_year` (1950–next year), `end_year` (≥ start_year), `grade` |
| `experience[]` | Array of objects | | each: `title` ✔, `organization` ✔, `type` (`job`\|`internship`\|`project`), `start_date`, `end_date` (≥ start_date), `is_current`, `description` (max 1000) |
| `job_preferences.desired_roles` | [String] | ✔ | at least 1 |
| `job_preferences.preferred_locations` | [String] | | `Any` means anywhere |
| `job_preferences.job_types` | [String] | ✔ | at least 1 of `full_time`, `part_time`, `internship`, `contract` |
| `job_preferences.expected_salary` | Number | | ≥ 0 (₹ per year) |
| `job_preferences.open_to_remote` | Boolean | | default `false` |
| `social_links.linkedin/github/portfolio` | String | | must be `http(s)://` URLs |
| `resume`, `cover_letter` | File metadata | | PDF/DOCX ≤ 2 MB |
| timestamps | Date | auto | |

Indexes: `user` unique.

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "user": ObjectId /* users._id */,
  "full_name": "<name>", "phone": "<phone>", "location": "<city>",
  "headline": "<text>", "summary": "<text>",
  "skills": ["<skill>"],
  "education": [{ "_id": ObjectId, "institution": "<text>", "degree": "<text>", "field_of_study": "<text>", "start_year": 0, "end_year": 0, "grade": "<text>" }],
  "experience": [{ "_id": ObjectId, "title": "<text>", "organization": "<text>", "type": "job", "start_date": ISODate, "end_date": ISODate, "is_current": false, "description": "<text>" }],
  "job_preferences": { "desired_roles": ["<role>"], "preferred_locations": ["<city>"], "job_types": ["full_time"], "expected_salary": 0, "open_to_remote": false },
  "social_links": { "linkedin": "<url>", "github": "<url>", "portfolio": "<url>" },
  "resume": { "stored_name": "<random>.pdf", "original_name": "<file>.pdf", "mimetype": "application/pdf", "size": 0, "uploaded_at": ISODate },
  "cover_letter": null,
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.3 `employerprofiles` — company profile, culture, verification (model `EmployerProfile`, US5)

| Field | Type | Required | Rules |
|---|---|---|---|
| `user` | ObjectId → `users` | ✔ | **unique**, role must be `employer` (enforced by the API) |
| `company_name` | String | ✔ | max 120 |
| `industry` | String | ✔ | max 80 |
| `location` | String | ✔ | max 100 |
| `website` | String | | `http(s)://` URL |
| `company_size` | String | | `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+` |
| `company_description` | String | ✔ | 30–2000 characters |
| `culture_description` | String | | max 2000 |
| `values` | [String] | | max 10 |
| `culture_tags` | [String] | | `collaborative`, `structured`, `innovative`, `fast_paced`, `independent` |
| `job_preferences.required_skills` | [String] | ✔ | at least 1 |
| `job_preferences.salary_range` | String | | max 60 |
| `logo` | File metadata | | PNG/JPG/WEBP ≤ 1 MB (the only public file type) |
| `verification.status` | String | | `not_submitted` (default) \| `pending` \| `approved` \| `rejected` |
| `verification.registration_number` | String | | 5–50 letters, digits, `-`, `/` |
| `verification.document` | File metadata | | PDF/PNG/JPG ≤ 5 MB, admin-only download |
| `verification.submitted_at`, `reviewed_at` | Date | | |
| `verification.reviewed_by` | ObjectId → `users` | | the admin who reviewed it |
| `verification.review_note` | String | | required by the API when rejecting |
| timestamps | Date | auto | |

Indexes: `user` unique.

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "user": ObjectId /* users._id */,
  "company_name": "<text>", "industry": "<text>", "location": "<city>", "website": "<url>", "company_size": "51-200",
  "company_description": "<30+ characters>", "culture_description": "<text>",
  "values": ["<value>"], "culture_tags": ["collaborative"],
  "job_preferences": { "required_skills": ["<skill>"], "salary_range": "<text>" },
  "logo": { /* file metadata */ },
  "verification": { "status": "pending", "registration_number": "<text>", "document": { /* file metadata */ },
                    "submitted_at": ISODate, "reviewed_at": null, "reviewed_by": null, "review_note": null },
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.4 `jobs` — job postings (model `Job`, US3 and US6)

| Field | Type | Required | Rules |
|---|---|---|---|
| `employer` | ObjectId → `users` | ✔ | indexed; only this employer can edit |
| `employer_profile` | ObjectId → `employerprofiles` | | |
| `company_name` | String | ✔ | copied from the employer profile |
| `title` | String | ✔ | max 120 |
| `description` | String | ✔ | 50–5000 characters |
| `skills_required` | [String] | ✔ | at least 1 |
| `qualifications` | String | | max 1000 |
| `experience_min` | Number | | 0–40, default 0 |
| `location` | String | ✔ | max 100 |
| `employment_type` | String | ✔ | `full_time` \| `part_time` \| `internship` \| `contract` |
| `is_remote` | Boolean | | default `false` |
| `salary_min` | Number | ✔ | ≥ 0 (₹ per year) |
| `salary_max` | Number | ✔ | ≥ `salary_min` |
| `culture_tags` | [String] | | same values as employer culture tags |
| `application_deadline` | Date | | cannot be in the past when set |
| `status` | String | | `open` (default) \| `closed`; indexed |
| `moderation_status` | String | | `active` (default) \| `removed` (by admin) |
| `moderation_note` | String | | reason for removal |
| timestamps | Date | auto | |
| `salary_range` | *virtual* | | computed in API responses, e.g. `₹6,00,000 - ₹10,00,000`; not stored |

Indexes: `employer`, `status`, and a text index on `title`, `description`, `skills_required`.

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "employer": ObjectId /* users._id */, "employer_profile": ObjectId /* employerprofiles._id */,
  "company_name": "<text>", "title": "<text>", "description": "<50+ characters>",
  "skills_required": ["<skill>"], "qualifications": "<text>", "experience_min": 0,
  "location": "<city>", "employment_type": "full_time", "is_remote": false,
  "salary_min": 0, "salary_max": 0, "culture_tags": ["structured"],
  "application_deadline": ISODate, "status": "open", "moderation_status": "active", "moderation_note": null,
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.5 `applications` — job applications (model `Application`, US4)

| Field | Type | Required | Rules |
|---|---|---|---|
| `job` | ObjectId → `jobs` | ✔ | job must be open, active, not past deadline, and **match** the seeker |
| `applicant` | ObjectId → `users` | ✔ | indexed; role `job_seeker` |
| `employer` | ObjectId → `users` | ✔ | indexed; copied from the job for fast employer queries |
| `cover_letter_text` | String | | max 2000 |
| `resume` | File metadata | | private copy of the profile resume at the time of applying |
| `match_score` | Number | | 0–100 |
| `status` | String | | `submitted` (default), `under_review`, `shortlisted`, `interview`, `hired`, `rejected`, `withdrawn` |
| `status_history[]` | Array | | each: `status`, `changed_at`, `changed_by` → `users`, `note` (max 500) |
| `confirmation_email.status` | String | | `sent` \| `logged` (no SMTP configured) \| `failed` |
| `confirmation_email.sent_at` | Date | | |
| timestamps | Date | auto | `createdAt` = application date |

Indexes: **unique compound (`job`, `applicant`)**, which blocks duplicate applications even if two requests arrive at once. Also `applicant` and `employer`.
Allowed status changes: submitted → under_review / shortlisted / rejected / withdrawn; under_review → shortlisted / rejected / withdrawn; shortlisted → interview / rejected / withdrawn; interview → hired / rejected / withdrawn. Only the applicant can withdraw.

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "job": ObjectId /* jobs._id */, "applicant": ObjectId /* users._id */, "employer": ObjectId /* users._id */,
  "cover_letter_text": "<text>", "resume": { /* file metadata */ }, "match_score": 0,
  "status": "submitted",
  "status_history": [{ "status": "submitted", "changed_at": ISODate, "changed_by": ObjectId, "note": null }],
  "confirmation_email": { "status": "sent", "sent_at": ISODate },
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.6 `assessmentresults` — personality assessment results (model `Assessment`, US2)

| Field | Type | Required | Rules |
|---|---|---|---|
| `user` | ObjectId → `users` | ✔ | indexed; a seeker can have several results, and the latest one is used |
| `answers[]` | Array | | all 20 questions required: `question_id` (String) ✔, `value` 1–5 ✔ |
| `scores.collaborative` … `scores.independent` | Number | ✔ | five traits, each 0–100 |
| `top_traits` | [String] | | the two highest traits |
| `summary` | String | | readable summary |
| `version` | Number | | question set version (default 1) |
| timestamps | Date | auto | `createdAt` = completion date |

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "user": ObjectId /* users._id */,
  "answers": [{ "question_id": "c1", "value": 4 } /* … 20 answers */],
  "scores": { "collaborative": 0, "structured": 0, "innovative": 0, "fast_paced": 0, "independent": 0 },
  "top_traits": ["<trait>", "<trait>"], "summary": "<text>", "version": 1,
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### 3.7 `connections` — networking (model `Connection`, US7)

| Field | Type | Required | Rules |
|---|---|---|---|
| `requester` | ObjectId → `users` | ✔ | indexed |
| `recipient` | ObjectId → `users` | ✔ | indexed; cannot be yourself or an admin |
| `status` | String | | `pending` (default) \| `accepted` \| `rejected` |
| `pair_key` | String | ✔ | both user ids sorted and joined with `_`; **unique**, so A→B and B→A cannot both exist |
| `responded_at` | Date | | |
| timestamps | Date | auto | |

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{ "_id": ObjectId, "requester": ObjectId, "recipient": ObjectId, "status": "pending",
  "pair_key": "<smallerId>_<largerId>", "responded_at": null, "createdAt": ISODate, "updatedAt": ISODate }
```

### 3.8 `messages` — private messages (model `Message`, US7)

| Field | Type | Required | Rules |
|---|---|---|---|
| `conversation_key` | String | ✔ | same format as `pair_key` |
| `sender` | ObjectId → `users` | ✔ | |
| `recipient` | ObjectId → `users` | ✔ | must have an **accepted** connection with the sender (checked by the API) |
| `message` | String | ✔ | 1–1000 characters, trimmed |
| `read_at` | Date | | set when the recipient opens the conversation |
| timestamps | Date | auto | |

Indexes: (`conversation_key`, `createdAt`) and (`recipient`, `read_at`).

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{ "_id": ObjectId, "conversation_key": "<smallerId>_<largerId>", "sender": ObjectId, "recipient": ObjectId,
  "message": "<text>", "read_at": null, "createdAt": ISODate, "updatedAt": ISODate }
```

### 3.9 `atsanalyses` — resume ATS results (model `ResumeAnalysis`)

| Field | Type | Required | Rules |
|---|---|---|---|
| `user` | ObjectId → `users` | ✔ | indexed; users only see their own |
| `job` | ObjectId → `jobs` | | set when a JobNest job was chosen |
| `source` | String | ✔ | `job` \| `custom` (pasted description) |
| `job_title` | String | | max 150 |
| `file_name` | String | | original resume name (file not stored) |
| `file_type` | String | | `pdf` \| `docx` |
| `word_count` | Number | | words read from the resume |
| `overall_score` | Number | ✔ | 0–100 |
| `breakdown[]` | Array | | each: `key`, `label`, `weight`, `score`, `applicable`, `details` |
| `matched_skills`, `missing_skills` | [String] | | |
| `keywords_found`, `keywords_missing` | [String] | | |
| `experience.required_years`, `experience.detected_years` | Number | | may be null |
| `recommendations` | [String] | | |
| timestamps | Date | auto | |

```jsonc
// SCHEMA EXAMPLE — structure only, do not insert
{
  "_id": ObjectId, "user": ObjectId, "job": ObjectId /* or absent */, "source": "job",
  "job_title": "<text>", "file_name": "<file>.pdf", "file_type": "pdf", "word_count": 0, "overall_score": 0,
  "breakdown": [{ "key": "skills", "label": "Skills match", "weight": 40, "score": 0, "applicable": true, "details": "<text>" }],
  "matched_skills": [], "missing_skills": [], "keywords_found": [], "keywords_missing": [],
  "experience": { "required_years": null, "detected_years": null },
  "recommendations": ["<text>"],
  "createdAt": ISODate, "updatedAt": ISODate
}
```

### Relationship map
```
users ─┬─< jobseekerprofiles (1:1)
       ├─< employerprofiles  (1:1) ─< jobs.employer_profile
       ├─< jobs.employer     (1:many)
       ├─< applications.applicant / .employer
       ├─< assessmentresults (1:many, latest used)
       ├─< connections.requester / .recipient
       ├─< messages.sender / .recipient
       └─< atsanalyses
jobs ──< applications.job
jobs ──< atsanalyses.job (optional)
```

---

## 4. Which screen writes to which collection

| User action (frontend page) | API call | Collection written |
|---|---|---|
| Register (`/register`) | `POST /auth/signup` | `users` (password hashed; duplicate email → 409) |
| Log in (`/login`) | `POST /auth/login` | reads `users`, compares bcrypt hash |
| Create/edit profile (`/profile`) | `POST /profiles`, `PUT /profiles/me` | `jobseekerprofiles`, `users.profile_completed` |
| Upload resume/cover letter | `POST /profiles/me/documents/:type` | file → `uploads/documents`, metadata → `jobseekerprofiles` |
| Take assessment (`/assessment`) | `POST /assessments/submit` | `assessmentresults`, `users.assessment_completed` |
| Company profile, logo, verification (`/company`) | `POST /profiles`, `PUT /profiles/me`, `/profiles/me/logo`, `/profiles/me/verification` | `employerprofiles` |
| Post/edit/close/delete job (`/employer/jobs`) | `POST/PUT/PATCH/DELETE /jobs…` | `jobs` |
| Apply (`/jobs/:id`) | `POST /jobs/:jobId/apply` | `applications` (references `jobs` + `users`) |
| Change application status | `PATCH /applications/:id/status` or `/withdraw` | `applications.status_history` |
| Connect / accept (`/network`) | `POST /connections`, `PATCH /connections/:id` | `connections` |
| Send message (`/messages`) | `POST /messages` | `messages` |
| ATS check (`/ats-checker`) | `POST /resumes/analyze` | `atsanalyses` (no file stored) |
| Admin actions (`/admin`) | `/admin/*` | `employerprofiles.verification`, `users.is_active`, `jobs.moderation_status` |

Every dashboard and list loads these collections through the API. The frontend has no hardcoded records.
Invalid ids return **400**, missing records **404**, duplicates **409**, and database errors **500**
with a safe message (details are printed only in the backend terminal).

## 5. Check that real records are saved
After using each feature in the browser, run these in mongosh (`use JobNestDB` first):
```javascript
db.users.find({}, { name: 1, email: 1, role: 1, password: 1 })   // password shows a $2a$12$… hash
db.jobseekerprofiles.find().sort({ createdAt: -1 }).limit(1)
db.employerprofiles.find({}, { company_name: 1, "verification.status": 1 })
db.jobs.find({}, { title: 1, employer: 1, status: 1 })
db.applications.find({}, { job: 1, applicant: 1, status: 1 })   // ObjectId references
db.assessmentresults.countDocuments()
db.connections.find(); db.messages.find()
db.atsanalyses.find({}, { job_title: 1, overall_score: 1 })
```
To check references, copy an `applicant` id from `applications` and run
`db.users.findOne({ _id: ObjectId("<that id>") })`.
