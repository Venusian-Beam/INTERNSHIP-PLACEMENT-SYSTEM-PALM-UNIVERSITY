# QA Execution Report · Phase 3 (Letters & placements)

## 1. Summary
- **Scope:** template versions and President approval or remarks, signature on file, letter grouping, HTML preview,
  PDF (dompdf), email sending with PDF + CVs, manual sending, cut-off, daily email limit, sent letters unchangeable,
  student copy. Placements: company reply (student or staff), confirming acceptance, returning an invalid acceptance,
  re-match after a decline, evaluation upload, Head completion. Plus all Phase 3 screens.
- **Result:** one Low defect fixed; one flaky test found and its root cause fixed. **66/66** API tests pass, stable over
  3 consecutive runs. **33/33** live end-to-end checks pass through the BFF.

## 2. Coverage
| Layer | Scenarios |
|---|---|
| Pest (Phase 3 + injection) | template placeholder validation (unknown placeholder, missing `students.table`); Head-only editing, President-only decisions; locked while with the President; approval supersedes the old version; remarks keep the approved one in force; no letters without an approved template (BR4); grouping by organisation, idempotent generate; **no student ID in letters**; email send with PDF + CVs; sent → placements `letter_sent`, PDF stored, student emailed, audit; double send refused; edit after send refused; **database trigger blocks any UPDATE to a sent letter**; failed SMTP → `failed`, never sent (NFR-R3); manual route; cut-off blocks generate; remove student → pool; students blocked from the workspace; reply once only; acceptance needs a letter; confirm; report; evaluation; Head-only completion requiring both documents; decline → re-match list → re-match (only one open placement); other students get 404 |
| Injection (LetterInjectionTest) | hostile organisation name, contact, address, student name, programme and **template HTML** (`<script>`, `<img src=file://…>`, `<iframe>`, `<svg onload>`) render escaped; preview served with `CSP default-src 'none'`; PDF renders with remote fetching off |
| Live E2E (33 checks) | President approves v2 → staff generate 2 letters → Volta letter groups 2 students with v2 wording and no student numbers → both sent → Volta inbox has PDF + 2 CVs → Ama opens her copy, uploads her acceptance (POST policy) → Kofi declines and can't read Ama's file → staff confirm, upload evaluation, re-match Kofi → staff can't complete → Ama's report → Head completes → Ama "Completed"; all Phase 3 pages 200 per role; CSP header reaches the browser through the proxy |

## 4–5. Defects
**QA-3-01 · Low · Rejected template versions lost their remarks in the President's history after a revision**
- *Root cause (confirmed):* saving a revision changed the rejected version's status from `remarks` to `superseded`.
- *Fix:* rejected versions keep `remarks`. The revision is created as the next version.
- *Regression:* `Phase3Test` checks the status stays `remarks` and the President's history shows the remark. **Closed.**

**Test defect (flaky) · random test names with apostrophes**
- *Repro:* intermittent. Faker produced a name like "O'Kon", which is correctly escaped (`&#039;`) in the HTML, so the
  raw-text comparison failed.
- *Root cause:* the test compared against unescaped text. *Fix:* compare against `e($name)`. Rerun ×3: stable.

## 6. Residual risk
- No visual check of the PDF in this environment (poppler isn't installed). HTML structure and escaping are tested, and
  the PDF is a valid `%PDF` file. **Action:** a person should review one printed letter before the pilot (also needed for OQ1 wording).
- An SMTP send holds a row lock for a few seconds. That's fine at one letter per request (AD7).
- An acceptance returned as "Not valid" doesn't email the student yet (they see the status change). Consider a notice.

## 8. Gate
Phase 3 exit criteria met (FR-T, FR-L, FR-PL, BR4–BR8 tested and verified live).
