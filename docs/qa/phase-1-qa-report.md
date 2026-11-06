# QA Execution Report · Phase 1 (Foundation & Identity)

## 1. Summary
- **Scope:** identity API (register, verify, login + emailed code, reset, invites, deactivate, rate limits, BFF trust),
  Next.js BFF proxy and session route handlers, role-guarded layouts.
- **Environment:** local, with web on :3000, API on :8010, Postgres 17, Mailpit and RustFS. Synthetic data only.
- **Result:** three defects found (1 Medium, 2 Low), all fixed and retested. **31/31** API tests pass.

## 2. Coverage
| Layer | What was exercised |
|---|---|
| Pest feature tests (31) | FR-A1–A8, BR on enumeration-safe responses, login code single use and lockout, role gates per role, deactivation revokes tokens, insert-only audit, BFF key and IP trust, regressions |
| Live API/BFF probes (curl) | token never in a browser response, HttpOnly cookie, cross-site POST rejected, direct API without key rejected, token endpoints blocked via proxy, encoded path traversal (`..%2F`, `%2e%2e`), method override, oversized payload (200 KB), timing of known vs unknown email, spoofed `X-Forwarded-For`, parallel duplicate registration, parallel login-code reuse |
| UI routing | student → staff area redirects; Head-only settings; logout invalidates the session |

**Not covered here (later phases):** automated accessibility scanning and browser E2E (Phase 4 Playwright), and load
testing (no requirement beyond NFR-PF targets).

## 3. Results
| Probe | Result |
|---|---|
| T1 login timing, known vs unknown email | ~0.6 s both. **Pass** (no enumeration by timing) |
| T2 traversal through proxy (4 variants) | all 404. **Pass** |
| T3 spoofed client IP vs per-IP rate limit | **Fail → QA-1-01**, fixed |
| T4 `X-HTTP-Method-Override` | 405. **Pass** |
| T5 200 KB field | 422. **Pass** |
| T6 parallel duplicate registration | 1 user created. Race path analysed → **QA-1-03**, fixed |
| T7 parallel reuse of one login code | 1 token issued, but the local server is single-threaded, so the race path was analysed → **QA-1-02**, fixed |

## 4–5. Defects
**QA-1-01 · Medium · Per-IP rate limits bypassable by spoofed `X-Forwarded-For`**
- *Repro:* send 7 POSTs to `/api/proxy/auth/register`, each with a different `X-Forwarded-For`. All 7 got 422; none got 429.
- *Root cause (confirmed):* the BFF forwarded the client-controlled `X-Forwarded-For` as the trusted client IP.
- *Impact:* email-bombing via register, resend or forgot-password, and faster login-code guessing (still capped at 5 tries per code).
- *Fix:* `web/src/lib/server/api.ts` trusts only a header named in `CLIENT_IP_HEADER`, which must be one set by the hosting
  platform (Vercel: `x-real-ip`). When none is configured it forwards no IP, so limits apply per server (stricter).
- *Retest:* the 6th spoofed request now returns 429. **Closed.**

**QA-1-02 · Low · Login code could be used twice by simultaneous requests**
- *Root cause (by code analysis):* the code was checked and then marked used in two steps.
- *Fix:* claim it with an atomic `UPDATE … WHERE consumed_at IS NULL`, and continue only if exactly one row changed.
- *Regression:* `RegressionPhase1Test` simulates the race. **Closed.**

**QA-1-03 · Low · Losing a duplicate-registration race returned 500 (and so revealed the account)**
- *Fix:* catch `UniqueConstraintViolationException` and give the same 201 answer as success.
- *Regression:* `RegressionPhase1Test`. **Closed.**

## 6. Residual risk
- Rate limits use the cache store (`database`). Fine for a pilot. Use Redis or Upstash if the system scales out.
- Browser back/forward cache can show a page after logout until refresh. The page has no data access, because the API
  rejects the request (cosmetic).
- On Vercel, `CLIENT_IP_HEADER=x-real-ip` must be set or limits become per-server. This is listed in the deployment notes.

## 8. Gate
Phase 1 exit criteria met: all FR-A requirements are tested, the adversarial probes pass, and the defects are fixed with regression coverage.
