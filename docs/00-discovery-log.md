# 00 · Discovery Log (source of truth)

Every requirement in docs 01–12 traces back to an ID in this log. If a document says something that isn't here, it's either
marked **Open question** or it's a mistake.

**ID scheme:** `F` = fact about today's process · `D` = product decision · `BR` = business rule · `AD` = architecture
decision · `UI-D` = UI decision · `G` = gap or contradiction found (and how it was resolved) · `A` = assumption · `RA` = risk.
Where a later entry replaces an earlier one, the later one wins (for example, AD5′ replaces AD5).

Discovery method: a Grill Me interview, run in stages, with the project owner (Nov 2026).

---

## Stage 1 · Current process (confirmed, F20)

| ID | Fact |
|---|---|
| F1 | Career Services opens the cycle by emailing students a Google Form. Applying is opt-in. Students give a motivation statement and choose destinations. |
| F2 | After applications close, Career Services books a one-on-one interview with each student. |
| F3 | Destinations can be organisations from Career Services' list (**Route A**) or organisations the student found themselves (**Route B**). Both routes start from the same form. |
| F4 | The interview screens the student (they can fail), matches them to an organisation and gives advice. It is the main decision point. |
| F5 | After the interview Career Services contacts organisations directly. |
| F6 | Career Services checks a student-sourced organisation (look it up, call it, judge fit with the programme) before a letter is issued. |
| F7 | Letters are signed, then usually emailed to the company. Printing is possible. |
| F8 | **Career Services** emails the signed letter to the company, on both routes. Companies have no accounts. |
| F9 | Route A organisations get the same introductory letter, naming the incoming student(s). |
| F10 | Companies reply either to Career Services or to the student. Some interview the student first. |
| F11 | If a company declines, Career Services re-matches the student or the student proposes a new organisation. No second interview. |
| F12 | One cycle a year, before the long break. The internship is mandatory to graduate, but not in any particular year. |
| F14 | All years (Year 1 to final year) can apply. |
| F15 | Career Services confirms that the internship has been completed, which counts towards graduation. |
| F16 | Completion is based on the student's report and a company evaluation form. |
| F17 | The company emails the evaluation form directly to Career Services. |
| F18 | Completion is a checklist only. No grading is recorded in the system. |
| F19 | Organisations reach Career Services' list through outreach, companies approaching Career Services, past placements, and partnerships/MoUs. |

## Stage 2 · Problems and success

| ID | Item |
|---|---|
| F21 | The **only** confirmed pain point: letters are slow to make. |
| F22 | Slow parts: typing each letter (which causes errors) and emailing with attachments. Signing and redoing letters after rejections are **not** pain points. |
| F23 | 100 to 500 applicants per cycle. |
| F24 | Success criteria: (1) a correct letter in minutes; (2) no name or company errors; (3) every student's stage visible; (4) graduation check is easy. Letters come first. |
| D2 | Version 1 scope = **letter-led core**. Status views are secondary (G4, G5). |

## Stage 3 · People and permissions

| ID | Decision |
|---|---|
| F25–F28 | Career Services is a team (staff plus a head). The President must approve letters. The President's signature is kept on file. The President sees and approves the letter *design*, not every letter. |
| D3 | A minimal third role, **President**: invite-only; can view the template, approve it or leave remarks. |
| D4 | **Approval chain:** Career Services prepares the template, then the President approves it, once per version. For each letter, a staff member previews and sends it, which is the human approval (R4). The President takes no action on individual letters (G6, G7). |
| D5 | **Roles:** Student · CS Staff · CS Head (staff powers plus managing staff accounts, editing the template and inviting the President, and marking Completed) · President. |
| D6 | If the President leaves remarks, Career Services revises the template and resubmits it. The last approved version stays in use. Letters can't be sent until the very first template is approved. |
| D7 | Students sign up themselves with their university email, confirmed by a link. |
| D8 | Students can view and download (read-only) the letter sent on their behalf. |

## Stage 4 · Data

| ID | Decision |
|---|---|
| F31 | Student data: name, student ID, programme, level, phone, email, motivation statement, CV. |
| D9 | Up to 3 ranked choices, mixing list organisations and the student's own. |
| D10 | Students choose organisations only. No "opportunity" records (places, departments). |
| D11 | Organisation fields: name, address, email, contact person, phone, sector. No partnership/MoU flag. |
| D12 | Students search the list before proposing an organisation. A new one is marked **Pending check**. Career Services approves it, merges it with an existing record or rejects it. Approved ones join the shared list. |
| D13 | One application per student per cycle. Completion is tracked per student. |
| D14 | Letter fields: reference number, issue date, internship period, company contact person and address, and each student's name, programme and level. **The student ID must not appear on the letter.** |
| D15 | Interview: only the outcome is recorded (date, pass/fail, matched organisation, notes). Booking happens outside the system. |
| D16 | Internship period defaults to the cycle's dates and can be changed per letter. |

## Stage 5 · Rules (confirmed, F33)

| ID | Rule |
|---|---|
| BR1 | One application per student per cycle, accepted only inside the window. Staff can let individual late applicants in (D24). Up to 3 ranked choices. |
| BR2 | Interview fail = **Not recommended**. The application closes, and the student can apply next cycle (D22). |
| BR3 | Student-sourced organisation: search first; a new one is Pending check. If the check fails, the reason is shown, and the student falls back to other choices or proposes a new organisation (D23). |
| BR4 | The template needs President approval for every version. After remarks, the last approved version stays in force. No letters before the first approval. |
| BR5 | Letters are grouped automatically by organisation (for unsent matches), can be adjusted before sending, and can't be changed once sent (D17). Only the students' CVs are attached (D19), with a cap of about 20 MB. Sent by the system, or downloaded and sent by hand and then **marked Sent** (D18). No letters after the cycle cut-off (D20). |
| BR6 | If a company declines: re-match or a new proposal, with no limit, until the cut-off (D20). |
| BR7 | The student uploads the acceptance letter and Career Services confirms it (D1). |
| BR8 | Completion = student report + evaluation form (uploaded by Career Services). The blank form is sent outside the system (D21). The Head marks Completed, once per student. |

## Stage 6 · Automation

| ID | Decision |
|---|---|
| D25 | Students get emails for: interview outcome · organisation check result (with reason) · letter sent (with copy link) · reminders to upload. The "applications open" announcement goes through the university mailing list, outside the system. |
| D26 | Reminders: acceptance letter 14 days after the letter is sent; report 7 days after the internship ends, then weekly. Career Services can change these. |
| D27 | Staff work from an in-system to-do dashboard. No staff emails. |
| D28 | Matching is fully human. The system never suggests a match. |

## Stage 7 · Reports and registry

| ID | Decision |
|---|---|
| D29 | Reports (on screen and exportable): pipeline per cycle · graduation status (filter by programme and level) · placements by organisation · by programme and sector. |
| D30 | Career Services can import the registry student list (CSV). Unregistered students show as "Not started" (G9). |
| D31 | Imported records link to accounts by university email. Students not on the list can still register, flagged "Not on registry list". |

## Stage 7b · Constraints

| ID | Item |
|---|---|
| F34 | A student project for now: low or no cost, portable, may be handed over to university IT. |
| F36 | Ghana's Data Protection Act, 2012 (Act 843) applies. |
| D32 | Student screens are designed for phones first, staff screens for desktops first. |
| D33 / A1 | Keep records until graduation + 2 years, then delete documents and keep a minimal placement history. Graduation year comes from the registry import, or is worked out from the student's level. Staff can edit it. |
| D34 | Letter authenticity = reference number + send log. No public verification page. |

## Stage 8 · MVP

| ID | Decision |
|---|---|
| D35 | **Release 2** (deferred): upload reminders, organisation report, programme/sector report, automatic deletion of old data. Everything else is Release 1. |

## Stage 9 · Architecture

| ID | Decision |
|---|---|
| AD1 | Next.js frontend + Laravel backend is a **fixed** requirement. |
| AD2 / AD4 | Free Vercel subdomains. Email goes through Gmail SMTP from the owner's Gmail (app password) for now. The sending address is configurable so it can move to the school address (G12). |
| AD5′ | Laravel runs **in Docker on Vercel's Container runtime** (beta). This replaces AD5 (`vercel-php`) (G13, G15). |
| AD6 | Files are kept in **Neon Object Storage** (S3-compatible, private, short-lived links). |
| AD7 | Bulk sending = one request per letter, with a progress bar and per-letter retry. No queue. |
| AD8 | Backend-for-frontend: the browser only talks to Next.js. The Sanctum token sits in an HttpOnly cookie. Laravel is the only authority on users and roles. |
| AD9 | Environments: local · preview (a Neon branch per PR, with fake data) · production, which **will hold real pilot data**. |
| AD10 | One repository: `/web`, `/api`, `/docs`. |
| AD11 | Tailwind CSS + shadcn/ui. |
| AD12 | The owner's personal Gmail sends pilot emails. This is an **accepted risk** (G14). |
| AD13 | Data stored in the EU, in the same region for Neon and Vercel. The cross-border transfer must be documented for the university's data protection officer. |
| AD14 | Backups: Neon's point-in-time restore + a nightly encrypted dump via GitHub Actions, kept for 14 days. Restore tested before the pilot. |
| AD15 | Staff, the Head and the President must enter an emailed one-time code at login. |
| AD16 | Audit trail of sensitive actions (see doc 04). |
| AD17 | Automated tests: Pest feature tests for BR1–BR8 and every role permission. Playwright browser tests of the critical journeys. CI runs on every PR. |

## Stage 10 · Frontend

| ID | Decision |
|---|---|
| UI-D1 / UI-D4 | University branding: white, green and black. Exact colour codes are still to be supplied; a readable placeholder green is used until then. **Logo supplied (2026-11-06):** the Palm Career Services crest (`Reference images/`). The green crest is used on white surfaces (all signed-in headers, the phone sign-in header and the browser-tab icon). The white crest is used on the green sign-in panel. Web copies are in `web/public/brand/`, 320 px. The white copy is recoloured from the green file because the supplied white file had stray marks. |
| UI-D2 | Student app: a simple list as the home page, with a hamburger menu. |
| UI-D3 | Staff app: a sidebar, and a to-do home page made of task cards. |
| UI-D5 | Applying is a 4-step wizard with a Review step. Drafts save automatically. |
| UI-D6 | Letter workspace: organisation groups on the left, live preview on the right, sending with progress and retry. |
| UI-D7 | Deliverables: a UI spec (doc 12) and a clickable prototype. |
| UI-D8 | Cycles and the registry import are **Head-only** (G16). |
| UI-D9 | Light and dark mode, following the device setting. Letters always render on white. |
| UI-D10 | The screen list is confirmed (see doc 12). |
| UI-D11 | Staff navigation is a **horizontal top bar** on laptops (brand-green bar with pill links), **not a sidebar**. This replaces the sidebar part of UI-D3. It wraps to a scrollable row on narrow screens. |
| UI-D12 | The staff home is an **insight dashboard** in the style of the user's reference, but more colourful: greeting, overview tiles with change vs last cycle, letter-outcome donut, work-queue chips (the D27 to-do), charts (applications by programme with applications / participation rate / placement rate, applications by level, applications per week, top host organisations), an acceptances-to-confirm table, and lists (organisations to check, letters ready, awaiting reply > 14 days). |
| G17 | The dashboard was described in terms of "departments", which the data model doesn't have. **Resolved:** the user meant **programme**, which already exists (F31, registry import D30). No new field. |
| D37 | The letter template is **uploaded** (Word .docx, Google Docs as .docx, or PDF) and then **edited in the browser** before it goes to the President. The **letterhead comes from the uploaded file** (the system no longer adds its own header and closing to uploaded templates). The Head places the **signature** where the President signs; sending is blocked until the reference, organisation, students and signature are placed. Replaces the typed-text editor of FR-T1. |
| D36 | The insight dashboard (UI-D12) ships in **Release 1**, and the organisation and programme/sector reports (FR-R3, FR-R4) move from Release 2 to Release 1. This partly replaces D35. G18 resolved. |

## Gaps found and how they were resolved

G1 vetting of student-sourced organisations → F6 · G2 who emails the letter → F8 · G3 completion vs where the process ends → F15 ·
G4 brief vs the one real pain point → D2 · G5 status view not a pain point but a success criterion → lower-priority requirement ·
G6/G7 approval chain → D4 · G8 how companies get the evaluation form → D21 · G9 graduation report misses unregistered students → D30 ·
G10/G13/G15 where Laravel runs → AD5′ · G11 why two apps → AD1 · G12 free URLs vs sending email → AD4 · G14 personal Gmail with
real data → AD12 (accepted risk) · G16 who manages cycles and the registry → UI-D8.

## Open questions (must be answered before the stated phase)

| # | Question | Needed by |
|---|---|---|
| OQ1 | The actual wording of Career Services' current introductory letter (the Word template). | Letter template phase |
| OQ2 | The official green colour code(s) and the university logo file. | Before the pilot |
| OQ3 | The President's signature image, and who uploads it. Proposed: the Head, in Settings, with the upload audit-logged. | Letter template phase |
| OQ4 | Reference number format. Proposed: `CS/INT/{YEAR}/{SEQ}`, configurable. | Letter phase |
| OQ5 | Approval from the university's data protection officer for EU storage (AD13), and Career Services' consent to the pilot, including the AD12 disclosure. | Before the pilot |
| OQ6 | The official Career Services sending address, to replace the personal Gmail. | Before or during the pilot |
| OQ7 | Gmail's per-message attachment size limit. Not confirmed from Google's page. The design caps attachments at about 20 MB. | Letter phase |
