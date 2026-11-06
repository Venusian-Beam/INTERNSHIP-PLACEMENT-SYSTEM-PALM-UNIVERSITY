# 02 · Stakeholder Analysis

## System users (D5)

| Role | Who | Responsibilities | How they log in |
|---|---|---|---|
| **Student** | Any student, Year 1 to final year (F14) | Apply each cycle; propose organisations; record the company's reply; upload the acceptance letter and report | Self-registration with university email + emailed confirmation link (D7). Password only. |
| **CS Staff** | Career Services officers | Record interview outcomes and matches; check organisations; produce and send letters; confirm acceptances; upload evaluation forms | Invited by the Head. Password + emailed one-time code (AD15). |
| **CS Head** | Head of Career Services | Everything staff can do, plus manage staff accounts, edit the template and send it to the President, manage cycles, import the registry, mark Completed | Password + emailed one-time code. |
| **President** | President of the institution | Approve the letter template, or leave remarks, once per version | Invited by the Head (D3). Password + emailed one-time code. |

## People who are not users
| Stakeholder | How they take part |
|---|---|
| Companies and organisations | Receive letters by email. Reply to Career Services or the student. Email evaluation forms to Career Services. **No account** (F8, F10, F17). |
| Registry | Provides the student list that Career Services imports (D30). |
| University IT | May take over hosting (F34). Owns the official email domain (OQ6). |
| Data protection officer | Approves storage in the EU and the pilot (AD13, OQ5). |
| Academic departments | Not involved in v1. Grading happens outside the system (F18). |

## Permission matrix

✓ = allowed · own = only the user's own records · — = not allowed. The server enforces every cell (AD8 + Policies). Hiding
something in the interface is not counted as security.

| Action | Student | Staff | Head | President |
|---|---|---|---|---|
| Register / edit own profile, upload CV | own | — | — | — |
| Submit application (inside the window) | own | — | — | — |
| Let a late applicant in (BR1) | — | ✓ | ✓ | — |
| Propose an organisation | own | ✓ | ✓ | — |
| Approve, merge or reject an organisation | — | ✓ | ✓ | — |
| Record interview outcome and match | — | ✓ | ✓ | — |
| View students, applications, placements | own | ✓ | ✓ | — |
| Download a student's CV or documents | own | ✓ (audited) | ✓ (audited) | — |
| Create, group, preview, send, download letters; mark Sent | — | ✓ | ✓ | — |
| View or download a sent letter | own | ✓ | ✓ | — |
| Record the company's reply | own | ✓ | ✓ | — |
| Upload acceptance letter / report | own | ✓ | ✓ | — |
| Confirm acceptance (BR7) | — | ✓ | ✓ | — |
| Upload evaluation form | — | ✓ | ✓ | — |
| Mark Completed (BR8) | — | — | ✓ | — |
| Edit template; send it to the President | — | — | ✓ | — |
| Approve template or leave remarks | — | — | — | ✓ |
| Manage cycles; import registry (UI-D8) | — | — | ✓ | — |
| Manage staff accounts; invite the President | — | — | ✓ | — |
| Upload the President's signature (OQ3, proposed) | — | — | ✓ | — |
| View reports and export | — | ✓ | ✓ | — |
| View audit trail (proposed: Head only; not yet confirmed) | — | — | ✓ | — |
| Add an organisation directly as Active (Career Services maintains the list, F19) | — | ✓ | ✓ | — |
