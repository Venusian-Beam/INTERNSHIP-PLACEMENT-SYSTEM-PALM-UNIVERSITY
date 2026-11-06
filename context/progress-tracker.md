# Progress tracker

| Phase | Status | Notes |
|---|---|---|
| 0 · Scaffold | DONE | Next.js 16 + Laravel 13 + Sanctum, module folders, CI |
| 1 · Foundation and identity | DONE | QA: docs/qa/phase-1-qa-report.md (3 defects fixed), 31 tests |
| 2 · Cycles, students, organisations, applications | DONE | QA: docs/qa/phase-2-qa-report.md (3 defects fixed), 50 tests |
| 3 · Letters and placements | DONE | QA: docs/qa/phase-3-qa-report.md (1 defect + 1 flaky test fixed), 66 tests, 33 live E2E checks |
| 4 · Dashboard, reports, hardening + security assessment | DONE | QA: docs/qa/phase-4-qa-report.md (2 defects fixed); security: docs/security/security-assessment.md (SEC-01…07 fixed); 105 API tests, 3 browser tests |

## Decisions made during the build (with reasons)
- `cacheComponents` turned off in Next.js: every page is per-user and authenticated, so nothing can be cached and shared.
- Local S3 stand-in is RustFS: MinIO's public Docker image was withdrawn.
- Local Postgres runs on port 54329 (5433 was already taken on this machine).
- Composer runs from a checksum-verified `composer.phar` in the session scratchpad (Composer isn't installed globally).
- Laravel Boost skipped (optional tooling; its bootstrap note asked to pipe a remote install script).
- Emails are stored lower-cased with plain unique indexes (instead of citext). Duplicate detection uses `pg_trgm`.
- API on port 8010 (8000 is used by another program on this machine).
- Shared BFF key between Next.js and Laravel (`TrustBff`): the API refuses direct calls, and only the BFF can set the client IP.
- Uploads use presigned **POST policies** (S3 can't bind size or type on presigned PUT URLs). See QA-2-01.
- UI kit: small hand-built components on the theme tokens instead of the shadcn/ui CLI (AD11 intent kept: accessible,
  owned code; the CLI would add Radix dependencies and npm-11 install friction). Swappable later.
- Dashboard charts are dependency-free (SVG/CSS), following the dataviz method (validated palette, table view per chart).
- Security assessment: docs/security/security-assessment.md (SEC-01…07 fixed, production fail-closed config guard).
- Page CSP is a per-request nonce policy from `web/src/proxy.ts` (SEC-07), so every page renders dynamically.
- President template decision is labelled **Reject with remarks** (user feedback), docs aligned.

- **UI refresh (after Phase 4):** design system in `web/src/theme/tokens.css` + `web/src/components/ui.tsx`: ink-black top bar,
  white panels on a paper canvas, IBM Plex Sans (UI) + Source Serif 4 (titles), 8px radii, green only for actions and
  good states, chart palette only for data. `tailwind-merge` (pinned 3.3.1) added so a caller's classes override defaults.
- **Developer logs (local only):** with `APP_ENV=local` the API writes `logs/otp-codes.log` (one line per sign-in code)
  and `logs/mail.log` (every email with its text) in the project root (git-ignored). The sign-in code screen has a
  "Fill in" helper (dev server + `DEV_TOOLS=1` + request from this computer; 404 otherwise and in production builds).
- **UI v2 (light theme):** colourful dashboard after the user's reference: white two-row header, react-icons (Tabler),
  Poppins, accent palette in tokens.css, KPI cards with real weekly sparklines (`spark`), stage donut (`stages`).
  Dark theme kept dormant (`data-theme="dark"`).

- **Template upload (D37):** the Head uploads the letter (.docx / Google Docs .docx / PDF), edits it in a Tiptap editor
  (fields + signature block), then sends it to the President. Word is converted in the browser (mammoth + header logo via
  JSZip); PDF text on the server (smalot/pdfparser). Server sanitises every save (`TemplateSanitizer`); templates now have
  `format` text|html. 113 API tests, 5 browser journeys.

## How to run locally
1. `docker compose -f docker-compose.dev.yml up -d`
2. `cd api && php artisan migrate:fresh --seed && php artisan serve --port=8010` → http://127.0.0.1:8010
3. `cd web && npm run dev` → http://localhost:3000
4. Sign-in codes and emails: the `logs/` folder (otp-codes.log, mail.log), or Mailpit at http://localhost:8025
