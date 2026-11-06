# 11 · MVP Definition

**Release 1 test:** Career Services can run **one full cycle from start to finish** in the system and meet all four
success criteria (F24). *(D35)*

## Release 1 (MVP)
| Area | Included | FRs |
|---|---|---|
| Access | Student self-registration (university email, privacy notice), staff and President invites, login codes for privileged roles, password reset | FR-A1–A8 |
| Cycles and registry | Head manages cycles; registry CSV import with preview; account linking | FR-C1–C3, FR-S1–S4 |
| Organisations | List, student proposals (search first), check queue (approve, merge, reject), duplicate warnings | FR-O1–O5 |
| Applications | 4-step wizard, one per cycle, late admission, interview outcome, manual match | FR-P1–P7 |
| Template | Versioned template, President approve or remarks, signature added on the server | FR-T1–T5 |
| Letters | Auto-grouping, preview, system send with progress and retry, download and Mark Sent, can't be changed once sent, cut-off, student copy | FR-L1–L11 |
| Placements | Company reply, acceptance confirmation, re-match loop, report and evaluation uploads, Head marks Completed | FR-PL1–PL6 |
| Notifications | Event emails to students (interview outcome, organisation check result, letter sent) | FR-N1, FR-N3 |
| Dashboard | Staff to-do cards and queues | FR-D1 |
| Reports and insights | Pipeline, graduation status, by organisation, by programme and sector, CSV export, plus the insight dashboard (D36) | FR-R1–R6 |
| Audit | Sensitive-action audit trail, private files | FR-X1, FR-X3 |

## Release 2
Upload reminders (FR-N2) · automatic deletion of old data (FR-X2). (The organisation and programme/sector reports moved
to Release 1 under D36.) **The retention job must ship before the first student reaches graduation + 2 years.**

## Never in v1
Company accounts · automatic or suggested matching · interview booking · supervision, logbooks or grading · public
letter verification · "opportunity" listings · AI features.

## MVP acceptance criteria (mapped to success criteria)
1. **Letter in minutes:** in a test with 40 matched students across 15 organisations, staff produce and send every
   letter, with CVs attached, in under 15 minutes of staff time *(proposed target)*.
2. **No name or company errors:** every letter field comes from a record. Tests confirm no letter contains a student ID
   and every student/organisation pair matches the match records.
3. **Every student's stage visible:** the student list shows a correct stage for every student (registered or
   imported), matching the database state.
4. **Graduation check easy:** the graduation report lists every known student as Completed, Not completed or Not
   started, filters by programme and level, and exports to CSV.
5. **Rules hold:** all Pest tests for BR1–BR8 and the permission matrix pass in CI. The Playwright journey apply →
   letter sent → acceptance → completion passes.

## Prerequisites before the pilot (open questions)
OQ1 letter wording · OQ2 brand colours and logo · OQ3 signature image · OQ4 reference number format · OQ5 data
protection officer approval and Career Services consent (including the AD12 disclosure) · OQ6 official sending address
(recommended) · OQ7 Gmail attachment limit.
