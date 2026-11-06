# Internship Placement Management System

Web system for the university's Career Services to run internship placements: student applications, organisation
checks, introductory letters (generated, grouped, approved, emailed), company replies, completion, and an insight
dashboard. Requirements and decisions live in [`docs/`](docs/). Start with [`docs/00-discovery-log.md`](docs/00-discovery-log.md).

## Repository layout

```
.
├── docs/                    Requirements & design (00 discovery log … 12 UI spec)
├── api/                     Laravel 13 API (PHP 8.4) · Sanctum tokens
│   ├── app/Modules/         One folder per module (docs/08-modules.md)
│   │   ├── Identity/        Http/Controllers · Http/Requests · Actions · Models · Policies
│   │   ├── Cycles/  Students/  Organisations/  Applications/
│   │   ├── Letters/  Placements/  Files/  Notifications/
│   │   └── Dashboard/  Reports/  Audit/
│   ├── routes/api.php       JSON API (consumed only by the Next.js proxy)
│   └── tests/Feature/<Module>/   Pest tests: one per business rule and permission (AD17)
├── web/                     Next.js 16 (App Router, TypeScript, Tailwind 4)
│   └── src/
│       ├── app/(public)/    sign-in · register · verify-email · reset-password · login-code
│       ├── app/student/     phone-first: home · apply · applications/[id] (+ reply) · documents · profile
│       ├── app/staff/       desktop-first, top nav: dashboard · students · applications · organisations
│       │                    · letters · placements · reports · settings/{staff-accounts,template,cycles,registry-import,audit}
│       ├── app/president/   template review
│       ├── app/api/proxy/   backend-for-frontend proxy → Laravel (AD8)
│       ├── components/      shared UI (shadcn/ui components go in components/ui)
│       ├── lib/api.ts       browser API client (always via the proxy)
│       └── theme/tokens.css brand + chart colour tokens (swap the official green here, OQ2)
└── .github/workflows/ci.yml Pest + Next.js lint/build on every PR
```

## Run locally

```bash
# 1. Local services: Postgres (:54329), Mailpit (inbox http://localhost:8025), RustFS S3 (:9000)
docker compose -f docker-compose.dev.yml up -d

# 2. API: http://127.0.0.1:8010  (copy api/.env.example to api/.env and set the same BFF_SHARED_KEY as the web)
cd api && composer install && php artisan key:generate
php artisan migrate:fresh --seed && php artisan storage:prepare
php artisan serve --port=8010

# 3. Web: http://localhost:3000  (copy web/.env.example to web/.env.local)
cd web && npm install && npm run dev
```

**Demo accounts** (fictional data, password `Placement2026!` for all). Staff, Head and President also enter a
6-digit code that is emailed to them; read it in Mailpit at http://localhost:8025.

| Role | Email |
|---|---|
| Head of Career Services | head@careers.example |
| Career Services staff | staff@careers.example |
| President | president@careers.example |
| Students | ama.mensah@st.university.example, kofi.boateng@…, akosua.darko@…, yaw.asante@…, esi.owusu@… |

## Tests

```bash
cd api && vendor/bin/pest          # API feature tests (business rules, permissions, security regressions)
cd web && npm run test:e2e         # browser journeys (needs the local stack running; reseeds demo data)
```

Production targets: Vercel (web + Laravel in Docker, region fra1) and Neon (Postgres + Object Storage, Frankfurt).
See `docs/10-architecture.md`. QA reports are in `docs/qa/`, and build progress is in `context/progress-tracker.md`.

## Developer logs (local only)
While the API runs with `APP_ENV=local`, every email it sends is also written to plain files in the project's
**`logs/`** folder (git-ignored, created on first email):
- `logs/otp-codes.log`: one line per sign-in code: time, email, code, valid-until time.
- `logs/mail.log`: every email: recipient, subject, attachments and the plain-text message.

On the sign-in code screen, a "Dev only: latest code … Fill in" helper also appears (needs `DEV_TOOLS=1` in
`web/.env.local`, works only from this computer, never in a production build).
