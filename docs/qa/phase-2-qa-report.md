# QA Execution Report · Phase 2 (Cycles, students, organisations, applications)

## 1. Summary
- **Scope:** Files (presigned upload and download, confirmation), cycles, registry import, student profile, application
  wizard (draft, submit, window), organisation proposals and check queue (approve, merge, reject), interview outcome and
  matching, late admission, student emails. Plus all Phase 2 web screens.
- **Environment:** local, with web on :3000, API on :8010, Postgres, RustFS (S3) and Mailpit. Synthetic data.
- **Result:** three defects (1 Medium, 2 Low), all fixed with regression tests. **50/50** API tests pass, and the web
  type-check and lint are clean.

## 2. Coverage
| Layer | Scenarios |
|---|---|
| Pest (Phase 2 + regressions, real S3) | uploads by role, type and size; magic-byte rejection deletes fakes; download ownership (other student, President → 404); staff downloads audited; signature never served; foreign file can't be attached as a CV; draft → submit once; incomplete profile, missing CV, no choices; window closed vs late admission; choosable organisations (active or own pending only); students can't see others' proposals or contact details; merge moves choices; approve needs email; reject emails the reason; outcome needs an active organisation; outcome is recorded once; students blocked from staff endpoints; Head-only cycles and registry; CSV validation incl. formula injection and duplicates |
| Live E2E through the BFF | CV upload straight to storage → confirm → attach; propose → save draft → submit; staff queue approve; outcome pass → placement → student stage "Matched"; emails in Mailpit; cross-student CV fetch → 404; all Phase 2 pages return 200 for the right role |
| Adversarial probes | oversized upload against the declared size (presigned PUT) → **QA-2-01**; double-submitted outcome → **QA-2-02** (code review + test); submit without a transaction → **QA-2-03** |

## 4–5. Defects
**QA-2-01 · Medium · Upload size and type not enforced by storage**
- *Repro:* presign `size=1000`, PUT 300 KB to the URL → **200** (object stored). `X-Amz-SignedHeaders=host`.
- *Root cause (confirmed):* S3 never signs `Content-Length` (or `Content-Type`) on presigned PUT URLs, so only the
  post-upload check stopped oversized files. Abandoned uploads stayed in the bucket (cost and abuse risk).
- *Fix:* switched to a **presigned POST policy** (`content-length-range 1..declared`, exact key, exact type). Storage
  rejects violations itself (verified: 400 `EntityTooLarge`). Also a 20-per-hour upload-link limit per user, and abandoned
  pending uploads older than 1 hour are swept. The post-upload magic-byte and size check stays as a second defence.
- *Regression:* `RegressionPhase2Test` (oversized POST → 400 and no object stored; normal upload OK; stale sweep). **Closed.**
- *Deployment note:* confirm that Neon Object Storage supports POST policies before go-live. Fall back to Cloudflare R2
  (which supports them) if not.

**QA-2-02 · Low · Outcome could be recorded twice under a double-submit race**
- *Fix:* the status check and the update now run inside a transaction with `SELECT … FOR UPDATE`. (A partial unique index
  also blocks a second open placement at the database level.)
- *Regression:* the second submit returns 422 and exactly one placement exists. **Closed.**

**QA-2-03 · Low · Application submit was not atomic** (the lock was used outside a transaction). Wrapped in a
transaction. Covered by the existing submit-once test. **Closed.**

## 6. Residual risk
- The student list works out each row's stage with a few queries per row. It's fine at pilot scale (limit 300 rows);
  optimise it if registry lists grow large.
- Organisation names come from students and appear in emails to that same student only, through Laravel's escaped mail
  templates. Phase 4 CSV exports must neutralise spreadsheet formulas (registry import already rejects them).

## 8. Gate
Phase 2 exit criteria met (FR-C, FR-S, FR-O, FR-P, BR1–BR3 tested). Defects fixed with regression coverage.
