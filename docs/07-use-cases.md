# 07 · Use Cases

| UC | Name | Primary actor | FRs |
|---|---|---|---|
| UC1 | Register and verify account | Student | FR-A1–A3 |
| UC2 | Submit application | Student | FR-P1–P2, FR-O3 |
| UC3 | Propose an organisation | Student | FR-O3, FR-O5 |
| UC4 | Check a proposed organisation | Staff | FR-O4 |
| UC5 | Record interview outcome and match | Staff | FR-P4–P7 |
| UC6 | Generate, preview and send letters | Staff | FR-L1–L10 |
| UC7 | Approve the letter template | President | FR-T2–T4 |
| UC8 | Record the company's reply | Student / Staff | FR-PL2, FR-PL4 |
| UC9 | Confirm acceptance | Staff | FR-PL3 |
| UC10 | Mark completion | Head | FR-PL5–PL6 |
| UC11 | Set up cycle and import registry | Head | FR-C1, FR-S2 |
| UC12 | Manage staff and invite the President | Head | FR-A4, FR-A8 |
| UC13 | View and export reports | Staff / Head | FR-R1–R5 |
| UC14 | View or download own letter | Student | FR-L11 |

---

### UC2 · Submit application
- **Preconditions:** the student is verified; the cycle window is open; the student has no application this cycle.
- **Main flow:** 1) open Apply → 2) confirm profile → 3) pick up to 3 ranked choices → 4) motivation → 5) upload CV
  (direct to storage) → 6) review → 7) submit. The application is now Submitted.
- **Alternatives:** 3a) organisation not listed → UC3 and come back. *Save and exit* keeps the draft.
- **Exceptions:** the window is closed → "Applications are closed. Contact Career Services." A second application in
  the same cycle is blocked (BR1). CV not a PDF or over 4 MB → the problem is shown next to the field.
- **Postconditions:** appears in the staff queue "Applications to interview".

### UC5 · Record interview outcome and match
- **Preconditions:** the application is Submitted.
- **Main flow:** staff open the application → enter the date and notes → choose **Pass** and pick the matched
  organisation from the ranked choices or any Active organisation → save. The student is emailed.
- **Alternatives:** **Not recommended** → the application closes (BR2) and the student is emailed.
- **Exceptions:** the chosen organisation is Pending check or Rejected → blocked (BR3).
- **Postconditions:** the student is in the "letters ready" pool for the matched organisation.

### UC6 · Generate, preview and send letters
- **Preconditions:** an Approved template exists (BR4); it's before the cycle cut-off (BR5); at least one matched
  student has no letter.
- **Main flow:** open the workspace → the system groups students by organisation → staff preview each PDF → tick the
  letters → **Send selected** → the system sends them one by one with progress → each is marked Sent → placements
  become Letter sent → students are emailed → actions are written to the audit log.
- **Alternatives:** **Edit group** to remove a student, or change the period. **Download + Mark Sent** for the manual route.
- **Exceptions:** an SMTP error → the letter becomes Failed and can be retried, never shown as Sent. Attachments over
  about 20 MB → sending is blocked with a message. The day's sends would exceed Gmail's 500 a day → warning. After the
  cut-off → blocked.
- **Postconditions:** sent letters can't be changed (BR5).

### UC7 · Approve the letter template
- **Preconditions:** the Head submitted a version, and the President has an active account.
- **Main flow:** the President logs in (password + code) → sees the template filled with sample data → **Approve**.
- **Alternatives:** **Reject with remarks** → the version gets status Remarks and the Head is shown the remarks.
- **Postconditions:** the approved version is used for all new letters. The previous approved version becomes
  Superseded. The decision is written to the audit log.

### UC8 · Record the company's reply
- **Preconditions:** the placement is Letter sent.
- **Main flow (student):** open the application → Record reply → **Accepted** → upload the acceptance letter (PDF) →
  submit. Status is now Acceptance submitted.
- **Alternatives:** **Declined** → the placement is Declined and the student goes back to matching (BR6). Staff record
  the reply when the company answered Career Services (F10).
- **Postconditions:** the item appears in "Acceptances to confirm", or the student appears for re-match.

### UC10 · Mark completion
- **Preconditions:** the placement is Accepted, and the report and evaluation form are both uploaded.
- **Main flow:** the Head opens "Ready to complete" → views both documents → **Mark Completed**.
- **Exceptions:** a document is missing → the action is disabled and the missing item is shown.
- **Postconditions:** the graduation report shows the student as Completed. The action is written to the audit log.

### UC11 · Set up cycle and import registry
- **Main flow:** the Head creates the cycle → uploads the registry CSV → the system validates it and shows a preview
  (new, updated, error rows) → the Head confirms → records are created or updated and matched by university email.
- **Exceptions:** missing required columns → the import is refused with a message. A row with a duplicate email →
  that row is reported as an error.
