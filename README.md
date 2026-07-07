# TeamFlow

A full-stack collaborative platform for software engineering teams to plan, execute, and
investigate work in one place: multi-project task management with dependencies, Kanban/
calendar/list views, structured Root Cause Analysis with mandatory reviewer sign-off,
in-app + email notifications, dashboards, and CSV export.

This repository is the Part 6 (Code Repository) deliverable for the TeamFlow systems
engineering assignment. See `DESIGN_DECISIONS.md` for the condensed architecture/decisions
write-up, and the accompanying assignment document for the full domain model, architecture
diagrams, business rules, and decisions log (Parts 1, 2, 3, 5).

## Stack

- **Backend:** Node.js + Express, PostgreSQL (via `pg`, raw SQL — no ORM), JWT auth, Multer
  for uploads, an in-process event bus standing in for a message broker.
- **Frontend:** React 18 + Vite, React Router, plain CSS with theme variables (no UI framework).
- **Storage:** Local disk (`server/uploads/`) behind a small abstraction that mirrors an
  S3-style `put/getPath/remove` interface — see "Assumptions" below.

## Project Structure

```
teamflow/
├── server/               Express API
│   ├── db/schema.sql     Full database schema (idempotent, run via npm run migrate)
│   ├── db/seed.sql       Optional demo data (3 users, 1 project, 2 tasks)
│   └── src/
│       ├── routes/       One file per resource (auth, projects, tasks, rca, ...)
│       ├── middleware/   auth (JWT), permissions (project role checks), errorHandler
│       ├── services/     notificationWorker.js (event bus consumer)
│       └── utils/        eventBus, storage, mailer, activityLog
├── client/               React (Vite) frontend
│   └── src/
│       ├── pages/        Projects, ProjectBoard (Kanban/calendar/list), RCAList, RCADetail, Dashboard
│       ├── components/   Nav, NotificationBell, TaskCard, TaskModal
│       └── context/      AuthContext, ThemeContext
└── docker-compose.yml    Local PostgreSQL for development
```

## Setup Instructions

### 1. Database

```bash
docker compose up -d          # starts PostgreSQL on localhost:5432
cd server
cp .env.example .env          # defaults already match docker-compose
npm install
npm run migrate               # applies db/schema.sql
npm run seed                  # optional: adds demo users/project/tasks
```

### 2. API server

```bash
cd server
npm run dev                   # http://localhost:4000
```

### 3. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Open `http://localhost:5173`, register an account (or log in with a seeded demo user —
see below), and create a project.

### Demo accounts (after `npm run seed`)

| Email | Role | Password |
|---|---|---|
| alice@teamflow.dev | Admin, project owner | password123 |
| bob@teamflow.dev | Contributor | password123 |
| cara@teamflow.dev | Contributor | password123 |

## Environment Variables

### `server/.env`

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://teamflow:teamflow@localhost:5432/teamflow` |
| `JWT_SECRET` | Signing secret for auth tokens | *(must be set to a real secret outside dev)* |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `UPLOAD_DIR` | Local folder used as the attachment store | `./uploads` |
| `NOTIFICATION_DEDUPE_WINDOW_SECONDS` | Documented; dedupe is currently enforced by a DB unique constraint rather than a rolling window — see Assumptions | `60` |
| `EMAIL_TRANSPORT` | `console` (default, logs emails instead of sending) | `console` |

### `client/.env`

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the API | `http://localhost:4000/api` |

## Assumptions Made During Implementation

- **Object storage is simulated with local disk.** `server/src/utils/storage.js` implements
  a `put/getPath/remove` interface matching what an S3-compatible SDK would expose. Swapping
  in a real S3 client would not require changing any route code, only this one file — this
  was a deliberate simplification so the assignment runs with zero cloud credentials.
- **The event bus is in-process (Node `EventEmitter`), not a real broker.** `eventBus.js`
  documents this explicitly. It preserves the publish/subscribe interface a real broker
  (SQS/RabbitMQ/Kafka) would have, so the notification worker doesn't need to change if this
  is swapped out later. This is a scale-appropriate simplification for a single-process
  assignment deployment (see Section 2.2 of the design decisions).
- **Email delivery defaults to a console logger**, not a real provider, so the app is
  runnable without any email account or API key. Set `EMAIL_TRANSPORT` and extend
  `mailer.js` to integrate a real provider (SES, Postmark, SMTP).
- **Notification deduplication is enforced via a database UNIQUE constraint**
  (`user_id, channel, dedupe_key`) rather than a literal "time window" check — this is
  actually a stronger guarantee than a rolling window (it never fires twice for the same
  event, regardless of timing), so the `NOTIFICATION_DEDUPE_WINDOW_SECONDS` env var is kept
  for documentation/future use but isn't read by the current dedupe logic.
- **Drag-and-drop on the Kanban board** uses the native HTML5 drag/drop API rather than a
  drag library, to keep frontend dependencies minimal.
- **The calendar view shows the current month only** with no forward/back navigation, to
  keep the scope of the assignment's implementation focused — see Known Limitations.
- **@mentions in comments are matched by email address** in the comment body (e.g.
  `@bob@teamflow.dev`) rather than a live autocomplete UI, to keep the parsing logic simple
  and testable.
- **Reviewer substitution is only allowed while a reviewer's decision is still pending** —
  once a reviewer has recorded a decision, that decision is preserved in the (immutable)
  `reviews` table even if the RCA is later withdrawn.
- **"Manager" vs "User" at login/register is a UI-level role selector mapped onto the
  existing `is_admin` flag** (Manager = admin), rather than a new database column. Login
  validates the selected role against the account's actual role after authenticating and
  rejects a mismatch client-side — the backend itself doesn't need the selection, since an
  account's role is inherent to its record, not to how someone logs in.

## Features Implemented

- Email/password auth (JWT), with a **User / Manager role selection at login and
  registration** (mutually exclusive checkboxes), an admin flag and per-project roles
  (owner / contributor / viewer). "Manager" maps to the account's admin flag; picking the
  wrong role on login is caught client-side against the account's actual role.
- Multi-project organisation; per-user, per-project view preference (Kanban/calendar/list)
  persisted across sessions.
- Kanban board (drag-and-drop status changes), calendar view (grouped by due date), and a
  filterable/sortable list view — all reading from the same task data.
- Task CRUD with priority, assignee, due date, parent/sub-task hierarchy, and a fixed
  status-transition rule set (backlog → in_progress → in_review → done, with defined
  back-transitions).
- Task dependencies (`blocks` / `blocked_by`) with non-blocking conflict warnings when
  marking a task done while a blocker is incomplete.
- Comments (with @mention parsing) and file attachments on both tasks and RCAs.
- Full RCA workflow: structured sections (timeline, contributing factors, corrective
  actions, preventive measures), multi-reviewer assignment, mandatory-comment decisions,
  sign-off gating (cannot close until every reviewer has decided), reviewer substitution
  for an unavailable reviewer, and an explicit Withdraw path with a mandatory reason when a
  review can't be completed as expected.
- Event-driven notifications (task assignment, status change, RCA submission, review
  decisions) delivered in-app and by email, with duplicate suppression and per-user email
  opt-out.
- Dashboards: completion rate, workload per assignee, velocity trend, RCA volume by status,
  and a simple project health score — computed live on every request.
- CSV export of the task list, scoped to whatever filter is currently active.
- Light/dark theme toggle (applied instantly, no reload) and a responsive layout.
- Append-only activity log backing every state change (status changes, reassignments, RCA
  submissions/decisions/closures/withdrawals, reviewer substitutions).

## Known Limitations

*(Carried over from, and consistent with, the assignment write-up's own Known Limitations
section — repeated here per the brief's requirement that the README states them.)*

- In-app notifications are delivered by polling every 15 seconds, not push, so there is a
  short delay before an event appears — an accepted tradeoff, not a bug (see design
  decisions, Section 2.4 / 3.3).
- Email failures are logged, not silently retried in the background.
- Uploaded files are accepted based on declared type and size only; there is no content
  inspection or malware scanning.
- The calendar view only shows the current month with no navigation to other months.
- Theme preference is stored in `localStorage` and does not carry across devices/browsers.
- The project-health score in the dashboard is a simple heuristic (completion rate minus an
  overdue-task penalty), not a validated metric.
- There is no real-time collaborative presence (e.g. "who's viewing this task right now") —
  listed as a future improvement in the assignment write-up.
- Object storage, the event bus, and email delivery are all local/in-process
  simplifications appropriate for this assignment's scale — see "Assumptions" above for
  what a production deployment would swap in.

## Tests

A minimal smoke-test harness lives in `server/tests/` (run with `npm test` from `server/`).
Given the scope of the assignment, test coverage focuses on the business-rule-heavy paths:
task status transitions and RCA sign-off gating.


