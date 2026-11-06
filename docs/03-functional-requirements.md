# 03 · Functional Requirements

Format: **FR-xx** · requirement · *source IDs* · release (R1/R2). "The system shall…" is implied.

## FR-A · Accounts and access
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-A1 | Let students self-register using only an email at the configured university domain, and activate the account only after an emailed confirmation link is clicked. | D7 | R1 |
| FR-A2 | Show a privacy notice at registration: who holds the data, why, and how long it is kept. Record that the student accepted it. | F36, D33 | R1 |
| FR-A3 | Link a new student account to an imported registry record with the same university email. Otherwise flag the student "Not on registry list". | D31 | R1 |
| FR-A4 | Let the Head invite CS Staff, CS Head and President users by email. Those accounts can't be self-registered. | D3, D5 | R1 |
| FR-A5 | Require an emailed one-time code after the password for Staff, Head and President logins. | AD15 | R1 |
| FR-A6 | Provide password reset by email. Rate-limit login, registration, code entry and reset. | AD15 defaults | R1 |
| FR-A7 | Enforce the permission matrix in doc 02 on the server for every action. | D5 | R1 |
| FR-A8 | Let the Head deactivate staff accounts. | D5 | R1 |

## FR-C · Cycles (Head only)
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-C1 | Create and edit cycles: name, application open and close dates, letter cut-off date, default internship start and end. | BR1, D16, D20, UI-D8 | R1 |
| FR-C2 | Accept applications only while a cycle's window is open (BR1). | BR1 | R1 |
| FR-C3 | Block new letters for a cycle after its cut-off date. | D20 | R1 |

## FR-S · Students and registry
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-S1 | Student profile: full name, student ID, programme, level, phone, university email, CV (PDF). | F31 | R1 |
| FR-S2 | Head imports a registry CSV (at least email, name, student ID, programme, level; expected graduation year optional). Show a preview with row errors before committing. Report rows created, updated and rejected. | D30, A1 | R1 |
| FR-S3 | Work out the expected graduation year from level when the import doesn't include it. Staff can edit it. | A1 | R1 |
| FR-S4 | Staff can search and filter students by stage, programme, level, cycle and registry flag. Each student's detail page shows all their applications and placements. | F24-3 | R1 |

## FR-O · Organisations
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-O1 | Keep an organisation list: name, address, email, contact person, phone, sector. Status: Active, Pending check, Rejected or Merged. | D11 | R1 |
| FR-O2 | Staff can add organisations directly as Active. | F19 | R1 |
| FR-O3 | Before proposing a new organisation, a student must search the list. The proposal is created as Pending check, linked to that student. | D12 | R1 |
| FR-O4 | A check queue where staff **approve** (it becomes Active and joins the list), **merge** (into an existing organisation; choices and references move across) or **reject** (with a reason the student can see). | D12, D23 | R1 |
| FR-O5 | Warn about likely duplicates (similar names) when a student proposes an organisation or staff add one. | D12 | R1 |

## FR-P · Applications and interviews
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-P1 | 4-step application wizard: profile check, up to 3 ranked choices (listed or proposed), motivation statement, CV. Review before submitting. Drafts save automatically. | D9, UI-D5 | R1 |
| FR-P2 | Enforce one application per student per cycle. | D13, BR1 | R1 |
| FR-P3 | Staff can admit a late application by hand, recording who allowed it. | D24 | R1 |
| FR-P4 | Staff record the interview outcome: date, Pass/Not recommended, matched organisation (chosen from the student's ranked choices or any Active organisation), notes. | D15, D28 | R1 |
| FR-P5 | "Not recommended" closes the application for the cycle. No letters for that student in that cycle. | BR2, D22 | R1 |
| FR-P6 | Matching is manual only. The system never preselects or suggests a match. | D28 | R1 |
| FR-P7 | A student can't be matched to an organisation that is still Pending check or Rejected. | BR3 | R1 |

## FR-T · Letter template
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-T1 | The Head **uploads** the letter Career Services uses (Word .docx, a Google Doc downloaded as .docx, or PDF; old .doc must be re-saved as .docx). It opens as an editable document in the browser, keeping its letterhead and logo. The Head edits the wording and places **fields** (reference number, date, internship period, addressee, organisation name and address, students as a table or as names in a sentence) and the **signature** block. A version can be sent to the President only when the reference, organisation name, students and signature are placed. **No student ID field.** PDFs bring their text only. | R1–R3, D14, D37 | R1 |
| FR-T2 | Templates have versions with these statuses: Draft → With President → Approved, or Remarks. Once a newer version is approved, the older one becomes Superseded. | D4, D6 | R1 |
| FR-T3 | The Head sends a draft to the President, who sees a preview filled with sample data and can **Approve** or **Reject with remarks**. | D3, D4 | R1 |
| FR-T4 | Letters always use the latest **Approved** version. If none exists, letters can't be generated (BR4). | BR4, D6 | R1 |
| FR-T5 | The President's signature image is applied to letters on the server only. It can never be downloaded. | F28, AD defaults | R1 |

## FR-L · Letters
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-L1 | Group every passed-and-matched student who doesn't yet have a letter by matched organisation. Each group becomes one draft letter. | R2, D17 | R1 |
| FR-L2 | Staff can remove students from a draft group (they return to the pool) and change the internship period on a draft letter. | D16, D17 | R1 |
| FR-L3 | Fill every letter field from the records: unique reference number, issue date, period, addressee, organisation, students (name, programme, level). | R3, D14, OQ4 | R1 |
| FR-L4 | Preview the exact PDF before sending, showing the attachment list and total size. | D18, UI-D6 | R1 |
| FR-L5 | **Send by system**: email the organisation from the configured sending address, with the PDF and each listed student's CV attached. Warn and stop if attachments exceed about 20 MB. | D18, D19, AD4 | R1 |
| FR-L6 | **Bulk send**: send the selected letters one request at a time, with progress shown ("x of n") and each letter marked Sent or Failed, with Retry. | AD7 | R1 |
| FR-L7 | **Manual route**: download the PDF (for print or own email), then **Mark Sent**. Until then the letter shows "Generated, not sent". | D18 | R1 |
| FR-L8 | Once sent, a letter can never be changed. Students matched later get a new letter. | D17 | R1 |
| FR-L9 | Log every send (who, when, how, recipient, reference number) so Career Services can confirm a letter is genuine when asked. | D34, AD16 | R1 |
| FR-L10 | Block generating and sending letters after the cycle's cut-off. | D20 | R1 |
| FR-L11 | Students can view and download their own sent letter. | D8 | R1 |

## FR-PL · Placements and completion
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-PL1 | Sending a letter creates or updates a placement per listed student: status **Letter sent**. | — | R1 |
| FR-PL2 | Record the company's reply: the student (or staff, when the company replied to Career Services, F10) records **Accepted** with the acceptance letter uploaded, or **Declined**. | D1, F10 | R1 |
| FR-PL3 | Staff confirm a recorded acceptance, which moves the placement to **Accepted**. | BR7 | R1 |
| FR-PL4 | On **Declined**, return the student to matching: staff re-match from other choices or the student proposes a new organisation, with no limit until the cut-off. | BR6, F11 | R1 |
| FR-PL5 | The student uploads their report. Staff upload the company's evaluation form. | BR8, F17 | R1 |
| FR-PL6 | The Head marks the placement **Completed** once both documents are present. Completion counts once per student. | BR8, D13 | R1 |

## FR-N · Notifications
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-N1 | Email the student when: the interview outcome is recorded · their proposed organisation is approved or rejected (with the reason) · their letter is sent (with a link to their copy). | D25 | R1 |
| FR-N2 | Reminders: acceptance not recorded 14 days after sending; report missing 7 days after the period ends, then weekly. Career Services can change the intervals. | D26 | **R2** |
| FR-N3 | Staff get no email notifications. They use the to-do dashboard. | D27 | R1 |

## FR-D · Staff dashboard
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-D1 | To-do cards with counts, each opening a filtered queue: applications to interview · organisations to check · letters ready to send · acceptances to confirm · placements missing completion documents · placements ready to mark Completed (Head). | D27, UI-D3 | R1 |

## FR-R · Reports
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-R1 | Cycle pipeline: counts of applied, interviewed, passed, not recommended, letter sent, accepted, declined, completed. | D29 | R1 |
| FR-R2 | Graduation status: every known student (registered or imported) marked Completed or Not completed, filterable by programme and level. Imported students who never registered show as "Not started". | D29, D30 | R1 |
| FR-R3 | Placements by organisation: students per organisation and acceptance rate. | D29, D36 | R1 |
| FR-R4 | Breakdown by programme and sector. | D29, D36 | R1 |
| FR-R6 | Insight dashboard for staff (UI-D12): overview tiles with change vs the previous cycle, letter-outcome donut, and charts of applications by programme (count, participation rate, placement rate), by level, per week, and by top host organisation. Each chart has a one-line takeaway written from the data, a hover tooltip and a table view. | UI-D12, D36 | R1 |
| FR-R5 | Export every report to CSV. | D29 | R1 (for R1 reports) |

## FR-X · Audit and data lifecycle
| ID | Requirement | Source | Rel |
|---|---|---|---|
| FR-X1 | Audit these actions: letter sent or marked Sent; template submitted, approved or remarked; Completed marked; organisation approved, merged or rejected; staff accounts invited, changed or deactivated; registry imported; staff downloading a CV or document; signature uploaded. | AD16 | R1 |
| FR-X2 | Retention job: when a student passes graduation + 2 years (A1), delete their CV and documents and keep the minimal placement history (name, organisation, year, completed). | D33 | **R2** |
| FR-X3 | Store files privately. Uploads go straight to storage through short-lived upload links, and downloads use short-lived links issued only after a permission check. | AD6, Vercel 4.5 MB limit | R1 |
