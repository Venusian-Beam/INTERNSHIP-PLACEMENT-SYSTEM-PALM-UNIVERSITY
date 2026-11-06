# 13 · Phase Plan (4 phases)

Each phase finishes with: QA run (`/qa-engineering`), all tests green, both apps running locally for review, and an
update to `context/progress-tracker.md`. After Phase 4, a full security assessment (`/adaptive-appsec-pro`) covers all
phases, and every flaw it finds is fixed and retested.

Local stack (`docker-compose.dev.yml`): Postgres 17 (stands in for Neon), Mailpit (catches all email, inbox at
http://localhost:8025), RustFS (S3-compatible stand-in for Neon Object Storage).

## Phase 1 · Foundation and identity
**Objective:** a running, secure skeleton that people can log into, with the full database schema in place.
- Full Postgres schema from doc 09 (all tables, CHECK constraints, unique and partial indexes, a guard that makes sent
  letters unchangeable, and an insert-only audit table).
- Identity: student self-registration (university domain only, privacy consent, email verification), login, emailed
  one-time code for staff, Head and President, logout, password reset, Head invites (staff, Head, President),
  deactivating staff, rate limits, Sanctum tokens that expire.
- Audit logger. Development seed data.
- Web: backend-for-frontend proxy (token in an HttpOnly cookie, origin check, auth endpoints blocked through the
  proxy), sign-in with the code step, register, verify, reset, accept invite, area layouts that check the user's role,
  Head › Staff accounts.
- **Acceptance:** FR-A1–A8 pass as Pest tests. A student cannot open the staff or President areas. The token never
  reaches browser JavaScript.

## Phase 2 · Cycles, students, organisations and applications
**Objective:** a student can apply, and staff can check organisations and record interviews.
- Files module (presigned upload and download, type and size checks, permission-checked).
- Cycles (Head), registry CSV import with preview, student profile with CV.
- Organisation list, student proposals (search first, duplicate warning), check queue (approve, merge, reject with reason).
- Application wizard (drafts, one per cycle, inside the window), late admission, interview outcome, manual match.
- Student emails: interview outcome, organisation check result.
- **Acceptance:** FR-C, FR-S, FR-O, FR-P and BR1–BR3 pass as tests. Uploads go straight to storage.

## Phase 3 · Letters and placements
**Objective:** the core pain point is solved: correct letters in minutes, plus the placement lifecycle.
- Template versions, Head submits, President approves or rejects with remarks, signature upload (never served to browsers).
- Grouping by organisation, PDF (dompdf), reference numbers, sending one letter per request with progress and retry,
  download and mark sent, sent letters unchangeable, cycle cut-off, Gmail daily-limit guard, student copy.
- Placements: company reply (student or staff), confirm acceptance, decline and re-match, completion documents, Head
  marks Completed. Letter-sent email. Audit entries.
- **Acceptance:** FR-T, FR-L, FR-PL and BR4–BR8 pass as tests.

## Phase 4 · Dashboard, reports and hardening
**Objective:** insight and oversight, then security.
- Staff dashboard (work queues, overview tiles, outcomes donut, programme, level, weekly and organisation charts with
  table views), reports (pipeline, graduation status, by organisation, by programme and sector) with CSV export,
  Head audit trail view.
- Security assessment of all phases, fixes, retest.
- **Acceptance:** FR-D1, FR-R1–R6, FR-X1 pass. Security findings are fixed or explicitly accepted.

Deferred (Release 2, D35/D36): upload reminders, retention clean-up job. Deployment to Vercel and Neon is a later step
(it needs the owner's accounts).
