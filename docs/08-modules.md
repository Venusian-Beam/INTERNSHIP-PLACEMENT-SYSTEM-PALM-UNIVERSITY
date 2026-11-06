# 08 · System Modules

Laravel is one app (`/api`) split into feature modules (AD5′, NFR-M3). Each module owns its tables, policies, routes and
tests. Next.js (`/web`) has a matching area for each one.

| Module | Responsibility | Main FRs | Key screens (doc 12) | Release |
|---|---|---|---|---|
| **Identity** | Registration, email confirmation, login, one-time codes, password reset, invites, roles, rate limits, privacy-notice consent | FR-A1–A8 | Public screens, Head › Staff | R1 |
| **Cycles** | Cycles, window and cut-off enforcement, default internship period | FR-C1–C3 | Head › Cycles | R1 |
| **Students** | Profiles, CVs, registry import and linking, graduation year | FR-S1–S4 | Students, Head › Registry | R1 |
| **Organisations** | Organisation list, proposals, check queue, duplicate warnings, merge | FR-O1–O5 | Organisations, Student › Propose | R1 |
| **Applications** | Wizard drafts, submission, late admission, interview outcomes, matching | FR-P1–P7 | Student › Apply, Applications | R1 |
| **Letters** | Template versions and approval, grouping, PDF rendering (dompdf), signature, reference numbers, sending (SMTP) and marking Sent, send log | FR-T1–T5, FR-L1–L11 | Letters workspace, Head › Template, President | R1 |
| **Placements** | Placement lifecycle, company replies, acceptance confirmation, completion documents, Completed sign-off | FR-PL1–PL6 | Placements, Student › Record reply | R1 |
| **Files** | Presigned upload and download links, file metadata, type and size checks, permission-checked access, download audit | FR-X3 | (used by every module) | R1 |
| **Notifications** | Student emails for events. Reminders in R2. Email log. | FR-N1–N3 | — | R1 / R2 |
| **Dashboard** | To-do counts and queues | FR-D1 | Staff › To do | R1 |
| **Reports** | Pipeline, graduation status, CSV export. By organisation, programme and sector in R2. | FR-R1–R5 | Reports | R1 / R2 |
| **Audit & Retention** | Audit trail. Retention job in R2. | FR-X1–X2 | Head › Audit (proposed) | R1 / R2 |

## Dependencies (build order)
Identity → Files → Cycles → Students → Organisations → Applications → Letters → Placements → Notifications/Dashboard →
Reports → Audit & Retention (R2 parts last).

## Frontend (`/web/src`) structure (as scaffolded)
Student and staff screens live under real URL segments (`/student/…`, `/staff/…`), not route groups, because both
areas have an `applications` page and route groups would make those two URLs collide.
- `app/(public)/`: sign-in, register, verify-email, reset-password, login-code (no URL prefix).
- `app/student/`: phone-first layout with a hamburger menu (UI-D2): home, apply, organisations/propose,
  applications/[id] (+ reply), documents, profile.
- `app/staff/`: desktop-first layout with the **horizontal top navigation** (UI-D11): dashboard, students(/[id]),
  applications(/[id]), organisations(/check), letters, placements, reports, settings/{staff-accounts, template, cycles,
  registry-import, audit} (Head).
- `app/president/`: a single template review page.
- `app/api/proxy/[...path]/`: the backend-for-frontend route that adds the token from the cookie and forwards to Laravel (AD8).
- `components/` (shadcn/ui goes in `components/ui`) · `lib/api.ts` · `theme/tokens.css`: brand and chart colour
  settings (UI-D4).

## Backend (`/api`) structure (as scaffolded)
`app/Modules/<Module>/{Http/Controllers, Http/Requests, Actions, Models, Policies}` plus a README per module, and
`tests/Feature/<Module>/`. API routes are in `routes/api.php`. Sanctum is installed (AD8).
