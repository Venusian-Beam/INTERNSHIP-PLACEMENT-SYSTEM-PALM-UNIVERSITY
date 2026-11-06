# QA Execution Report · Phase 4 (Dashboard, reports, hardening)

## 1. Summary
- **Scope:** staff insight dashboard (work queues, KPI tiles, outcome donut, programme, level, weekly and
  organisation charts with table views), reports (pipeline, graduation status, by organisation, by programme and
  sector) with CSV export, Head audit trail, browser E2E, and a robustness sweep across all phases.
- **Result:** two defects found and fixed (QA-4-01, QA-4-02). **105/105** API tests pass, **2/2** browser journeys
  pass in Chromium (with the new security headers active), web type-check, lint and Pint clean.

## 2. Coverage
| Layer | Scenarios |
|---|---|
| Pest (Phase4Test) | pipeline counts from a known fixture; graduation status distinguishes completed / not completed / never registered (D30); dashboard outcomes, queues and per-programme stats; students and President refused (403); **CSV formula neutralisation** (`=HYPERLINK`, `@`, `-`) and `text/csv`; audit view Head-only |
| Browser E2E (Playwright, Chromium) | President approves v2 → staff dashboard (greeting, programme chart, measure toggle shows the participation insight) → letters: generate, sandboxed preview renders, send 2 with progress → Sent tab locked → student Ama sees "Letter sent" and the next step. Access: a student redirected away from `/staff` and `/president`; Head-only API → 403 |
| Live probes | malformed filters (`level=abc`, `programme[]=`, `status=x'--`, `cycle_id=abc`); CSV download through the proxy (`Content-Disposition: attachment`); student access to every report → 403; **5xx sweep**: malformed IDs and bodies across 17 endpoints of all phases |

## 4–5. Defects
**QA-4-01 · Low · Unvalidated list/report filters caused 500 errors** (`/reports/graduation?level=abc`, `/students?level=abc`)
- *Evidence:* HTTP 500 with `SQLSTATE[22P02] invalid input syntax` (visible locally because debug is on; production
  refuses to boot with debug on, see SEC-02).
- *Root cause:* query parameters went into SQL comparisons on integer columns without validation (still bound, so no injection).
- *Fix:* explicit validation of `programme`, `level`, `status`, `registry`, `stage`, `search`, `cycle_id` → 422.
- *Regression:* `SecurityFixesTest` (7 malformed inputs → 422). Live retest → 422. **Closed.**

**QA-4-02 · Low · Malformed route IDs caused 500 errors on 10 routes** (`/students/abc`, `/files/abc/download`, 20-digit IDs, …)
- *Root cause:* route-model binding passed non-numeric or out-of-range values to Postgres bigint lookups.
- *Fix:* a global route pattern `[0-9]{1,18}` for every bound ID → non-matching routes are a clean 404.
- *Regression:* `SecurityFixesTest` (10 routes → 404). Live 5xx sweep: **no 5xx responses**. **Closed.**

## 6. Residual risk
- The browser E2E ran with an already-installed Chromium build (1234) through `E2E_CHROME`, while Playwright's own
  build (1194) was still downloading. Normal runs use the bundled build once the download completes.
- The student list stage calculation runs a few queries per row. Fine at pilot scale (300-row limit). Optimise if registry lists grow large.
- Charts use example demo data; real insight depends on importing the real registry list (D30).

## 8. Gate
Phase 4 exit criteria met: FR-D1, FR-R1–R6 and FR-X1 tested; full regression green; browser journeys pass.
