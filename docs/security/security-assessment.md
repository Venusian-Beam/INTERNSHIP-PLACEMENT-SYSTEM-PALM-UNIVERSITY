# Security Assessment · Internship Placement System (all four phases)

## 1. Scope, authorisation, environment
- **Authorised by:** the system owner, for their own system. **Target:** the local lab only (web `localhost:3000`,
  API `127.0.0.1:8010`, Postgres `:54329`, RustFS `:9000`, Mailpit `:8025`). No remote or third-party systems.
- **Data:** synthetic seed data only. No secrets were printed (only the on/off state of settings was checked).
- **Methods:** source review of every trust boundary; dependency audits; automated tests (Pest); live low-rate
  probes through the BFF with curl and a PHP driver; browser E2E (Playwright). Nothing destructive, no DoS.

## 2. Architecture and trust boundaries
```
Browser ──(HttpOnly session cookie, same-origin)──▶ Next.js BFF ──(X-BFF-Key, trusted client IP, Bearer token)──▶ Laravel API
   │                                                                                                   ├──▶ Postgres (constraints, triggers)
   └──(presigned POST/GET, short-lived)──▶ Object storage ◀────────────────────────────────────────────┤──▶ Object storage
                                                                                                       └──▶ SMTP (Mailpit / Gmail)
```
| Boundary | Controls verified |
|---|---|
| Browser → BFF | HttpOnly SameSite=Lax cookie; token never in JS; Origin check on non-GET; path allowlist; token-issuing endpoints blocked through the proxy; **security headers (SEC-01)** |
| BFF → API | shared key (`TrustBff`), 404 without it; client IP only from a platform-set header (QA-1-01); Bearer token; **60 s upstream timeout (SEC-06)** |
| API → data | role middleware on every route (test-enforced); ownership checks per record; DB constraints: one application per cycle, one approved template, sent letters immutable (trigger), insert-only audit log (trigger) |
| Browser → storage | presigned POST policy: exact key, type, size range (QA-2-01); downloads through 5-minute signed links after a permission check; signature never served |

## 3. Coverage and tools actually used
| Area | How |
|---|---|
| Dependencies | `composer audit` → **0 advisories**. `npm audit --omit=dev` → **0**. `npm audit` (all) → 8 moderate, all in the ESLint dev toolchain (`minimatch`), not shipped |
| Route authorisation | `RouteSecurityTest`: **every** `api/*` route needs `auth:sanctum` + a role gate except 8 public identity endpoints, all rate-limited. Anonymous probes → 401 |
| Identity | Phase 1 tests and probes: enumeration (responses + timing), login code (single use, lockout, race), rate limits, spoofed IP, password reset, invites, deactivation revoking tokens |
| Access control (IDOR / vertical) | tests per role for files, applications, organisations, letters, placements, reports, audit; live cross-student file and placement probes → 404 |
| Injection | SQL: query builder / bound parameters throughout (reviewed every `whereRaw` / `orderByRaw`). XSS: React escaping; no `dangerouslySetInnerHTML`; letter HTML escaped + `CSP default-src 'none'` + sandboxed iframes (LetterInjectionTest). PDF/SSRF: dompdf remote off, no injected tags. CSV formula injection: neutralised on export, rejected on import. Email: subjects system-generated; bodies escaped |
| Files | type allowlist, magic bytes, size enforced by storage, server-generated keys (no path traversal), sanitised names, `Content-Disposition`, abandoned-upload sweep, upload rate limit |
| Business logic | double send/submit/outcome/reply races (row locks, atomic updates), cut-off, template approval chain, Head-only completion, immutable sent letters |
| Config and headers | live header checks on web and API; CORS preflight from a hostile origin; debug and secret configuration |

## 4. Findings (ordered by risk)
| ID | Sev. | Finding | Status |
|---|---|---|---|
| QA-1-01 | Medium | Per-IP rate limits bypassable with a spoofed `X-Forwarded-For` (found in Phase 1 QA) | Fixed + retested |
| QA-2-01 | Medium | Presigned PUT didn't enforce upload size or type (found in Phase 2 QA) | Fixed + retested |
| **SEC-01** | **Medium** | **No security headers on the web app:** no CSP, no framing protection (clickjacking of "Approve version" / "Send selected"), no Referrer-Policy (reset/invite tokens in URLs could leak via Referer), `X-Powered-By` disclosed. *Evidence:* `curl -I /sign-in` returned only `X-Powered-By: Next.js` | **Fixed + retested** |
| **SEC-02** | **Medium (prod)** | **Fail-open production configuration:** `APP_DEBUG` on would send stack traces and SQL to browsers through the proxy; an empty `BFF_SHARED_KEY` silently disables the BFF check. API responses lacked nosniff, framing and no-store headers | **Fixed + retested** |
| SEC-03 | Low | API used Laravel's default CORS (any origin) although no browser should call it | Fixed + retested |
| SEC-04 | Low | `/organisations/similar` revealed names and status of **other students'** pending proposals to any student | Fixed + retested |
| SEC-05 | Low | No daily cap on wrong login codes per account (an attacker who has the password could keep requesting codes) | Fixed + retested |
| SEC-06 | Low | BFF → API calls had no timeout (a hung API ties up web server workers) | Fixed |
| SEC-08 | Medium (design) | Uploaded letter templates are HTML converted in the browser from a Word/PDF file, then printed into official letters and shown to the President: untrusted markup could carry script, tracking images or local-file references into previews and PDFs | **Controlled + tested** |
| SEC-07 | Low (hardening) | Page CSP allowed `'unsafe-inline'` scripts, so an XSS bug elsewhere would not have been contained by CSP | **Fixed + retested** |
| QA-4-01 | Low | Unvalidated report/list filters reached SQL and caused 500s (with debug output locally) | Fixed + retested |
| QA-4-02 | Low | Malformed route IDs (`abc`, 20 digits) caused 500s on 10 routes | Fixed + retested (5xx sweep clean) |
| QA-1-02/03, QA-2-02/03, QA-3-01 | Low | Races and history integrity (see QA reports) | Fixed + retested |

### Fix details
- **SEC-01:** `web/next.config.ts` sends `Content-Security-Policy` (self-only; connect-src adds only the storage
  origin; `frame-ancestors 'self'`; `object-src 'none'`; `form-action`/`base-uri 'self'`), `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS in production, and
  `poweredByHeader: false`. *Retest:* all headers present in a live `curl -I`; `X-Powered-By` gone.
- **SEC-02:** `AppServiceProvider::refuseUnsafeProductionConfig()` **refuses to boot in production** if `APP_DEBUG=true`,
  the BFF key is shorter than 32 characters, or the cron secret is weak or the dev value. The new `SecurityHeaders`
  middleware sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store` on
  every API response. *Regression:* `SecurityFixesTest` (boot refusal + headers).
- **SEC-03:** `api/config/cors.php` grants nothing. *Retest:* a preflight from `https://evil.example` returns no
  `Access-Control-Allow-*` headers.
- **SEC-04:** students only see Active organisations and their own proposals in duplicate suggestions. *Regression:* `SecurityFixesTest`.
- **SEC-05:** login codes are refused for 24 h after 15 wrong guesses or 30 issued codes per account (429
  `otp_locked`). The user can still reset their password. *Regression:* `SecurityFixesTest`.
- **SEC-06:** `AbortSignal.timeout(60_000)` on every BFF → API call.
- **SEC-08 (template upload):** the server never trusts the browser's HTML. `TemplateSanitizer` (symfony/html-sanitizer 8.1.11,
  the release that fixes three advisories in 8.1.10) keeps an allowlist of document tags only; a second DOM pass keeps
  only `text-align`/`width`/`height` styles and only embedded PNG/JPEG images (size-capped), regenerates field-chip text,
  and rejects unknown field keys. Field values are HTML-escaped at render time; dompdf stays `isRemoteEnabled=false`;
  previews stay in a sandboxed iframe with `default-src 'none'`. New file kind `template_source` (Head only, .docx by
  ZIP magic bytes, PDF by `%PDF-`, 4 MB). PDF text extraction (smalot/pdfparser) is wrapped and size-limited; legacy
  .doc is refused rather than parsed. *Regression:* `TemplateUploadTest` (7 tests: scripts/handlers/remote and SVG
  images/javascript: links stripped, escaping, required fields, Head-only import and upload). Browser E2E uploads a
  real .docx; a production-build run confirmed the converter works under the nonce CSP with no violations.
- **SEC-07:** `web/src/proxy.ts` sends a fresh per-request nonce policy on every page: `script-src 'self' 'nonce-…'
  'strict-dynamic'` (no `'unsafe-inline'`; `'unsafe-eval'` only in development). The root layout awaits `connection()` so
  every page renders per request and Next.js stamps the nonce on its scripts. Route handlers (`/api/*`) get a fixed
  `default-src 'none'` policy. Styles keep `'unsafe-inline'` (React style attributes can't carry nonces; CSS can't run
  code). *Retest:* production build → 17/17 script tags nonced, nonce differs per request, no `'unsafe-eval'`, HSTS on.
  *Regression:* E2E fails on any CSP violation during the journeys (none), and an injected `<img onerror>` payload does not run.

## 5. Results
- API: **105/105** Pest tests pass (business rules, permissions, route-auth guard, security regressions). Pint clean.
- Web: type-check, lint and production build clean. **Browser E2E 3/3 pass in Chromium with the new CSP and headers active**, so the
  hardening didn't break login, sandboxed previews, uploads, charts or sending.
- Robustness: a 5xx sweep over 17 endpoints across all phases with malformed IDs and bodies → **no 5xx responses**.
- Live: header retest, CORS retest, proxy traversal (4 variants → 404), cross-student file access (→ 404), direct API
  without the key (→ 404), token never in a browser response.

## 6. Residual risks and limits (not fixed, with reasons)
1. **CSP allows `'unsafe-inline'` styles** (needed for React style attributes). Style injection can't run script; low risk.
2. **Personal Gmail sending (AD12)** remains an accepted risk; switch to the official address (OQ6).
3. **Database role:** the app's DB user owns the tables, so in principle it could drop the audit or letter triggers.
   In production, run the app with a role that can't alter schema (migrations under a separate role).
4. **Neon Object Storage must support POST policies** (QA-2-01). Verify before go-live, or use Cloudflare R2.
5. **`CLIENT_IP_HEADER=x-real-ip` must be set on Vercel**, otherwise per-IP limits apply per web server (safe but strict).
6. Dev-only `npm audit` advisories (ESLint toolchain) are accepted. Re-audit on each dependency update.
7. Not tested here: TLS/hosting configuration (no deployment yet), email deliverability (SPF/DKIM), load and DoS
   resilience, and the production Vercel and Neon settings. These belong to the deployment security review.

## 7. Next actions (priority order)
1. Before the pilot: set the production secrets (`APP_DEBUG=false`, 32+ character `BFF_SHARED_KEY` and `CRON_SECRET`, `CLIENT_IP_HEADER`). The app now refuses to start without the API ones.
2. Verify that Neon Object Storage supports POST policies, or choose R2.
3. Create a restricted production DB role for the app.
4. Run a deployment security review (`/deployment-security`) when deploying to Vercel and Neon.
