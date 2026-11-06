# 12 · UI Specification

Screen inventory confirmed in UI-D10. Built with Next.js, Tailwind and shadcn/ui (AD11). Every screen has **empty /
loading / error** states, problems explained next to each field, and meets WCAG 2.1 AA (NFR-U2, NFR-U4).

## Theme settings (UI-D1, UI-D4, UI-D9)
| Setting | Light | Dark | Note |
|---|---|---|---|
| `--brand` | `#0F7A3D` *(placeholder green)* | `#3DBA6E` | Swap for the official green (OQ2). Must reach 4.5:1 contrast with its text colour. |
| `--brand-fg` | `#FFFFFF` | `#0A0A0A` | text on brand buttons |
| `--bg` / `--surface` | `#FFFFFF` / `#F6F7F6` | `#0B0D0C` / `#151917` | |
| `--text` / `--muted` | `#0A0A0A` / `#4B5563` | `#F3F4F3` / `#A3ABA6` | black = brand text colour |
| `--danger` / `--warn` / `--ok` | red / amber / green shades | lighter versions | status badges always carry an icon and label, not colour alone |
| Letter preview | always `#FFFFFF` paper | same | UI-D9 |

Logo: placeholder wordmark "Career Services" until the logo file arrives (OQ2).

## Status badges (shared)
Applied · Not recommended · Matched · Letter sent · Acceptance submitted · Accepted · Declined · Needs re-match ·
Completed · Not started · Pending check · Rejected · Generated · Sent · Failed.

---

## Public (5)
| Screen | Content and actions | Notes |
|---|---|---|
| P1 Sign in | Email, password → [Sign in]. Links to register and reset. | Rate-limited, generic error message |
| P2 Register | Full name, university email (domain checked), password, **privacy notice** (expandable) + accept checkbox → [Create account] | FR-A1–A2 |
| P3 Verify email | "Check your inbox" + [Resend]. The link opens a success page. | |
| P4 Reset password | Request a link, then set a new password | |
| P5 Login code | 6-digit input, [Verify], [Resend code], expiry countdown | Staff, Head, President only (AD15) |

## Student · phone-first, hamburger menu (7)
Menu: Home · My application · Documents · Profile · Sign out.

**S1 Home** (UI-D2: a simple list)
```
┌──────────────────────────┐
│ ☰  Career Services       │
│ Hi Ama · Long break 2026 │
│                          │
│ MY APPLICATION           │
│  Status   [Letter sent]  │
│  Org      MTN Ghana      │
│  Next     Record MTN's   │
│           reply →        │
│                          │
│ MY DOCUMENTS             │
│  CV.pdf              ⤓   │
│  Letter CS/INT/…0143 ⤓   │
│  Acceptance  — Upload →  │
└──────────────────────────┘
```
Empty state (no application, window open): "Applications are open until 30 Apr" + [Start application]. Window closed:
"Applications are closed."

**S2 Apply wizard** (UI-D5): step dots ●●○○ · Back and Next · drafts save automatically (with a "Saved" indicator).
1. Profile check (prefilled, editable). 2. Choices: three ranked search boxes (Active organisations only) + "Not listed?
Propose an organisation". 3. Motivation (text area with a character count). 4. CV upload (PDF ≤ 4 MB, uploaded
straight to storage with progress). **Review** → [Submit application].

**S3 Propose organisation**: the search box comes first. If the student's text resembles an existing organisation, show
"Did you mean MTN Ghana?". Form: name, address, email, contact person, phone, sector → [Submit for check]. Result:
the choice is shown as "Pending check".

**S4 Application detail**: ranked choices with each one's status (Pending check / Rejected + reason) · interview outcome
· matched organisation · letter (view or download) · placement status history.

**S5 Record company reply**: [Accepted] → upload the acceptance letter (PDF) → submit; or [Declined] → confirm.
Message afterwards: "Career Services will confirm" or "You'll be re-matched; you can also propose another organisation".

**S6 Documents**: CV (replace), letter copies (read-only), acceptance letter, internship report (upload after the internship).

**S7 Profile**: name, student ID, programme, level, phone, email (read-only), change password.

## Staff · desktop-first, horizontal top navigation (7) (UI-D11)
A brand-green top bar holds the logo, pill links (Dashboard · Students · Applications · Organisations · Letters ·
Placements · Reports · *Settings (Head)*), queue counts on the links, a cycle pill and the user's avatar. Below 1024 px
the links wrap to their own row, which scrolls sideways.

**T1 Dashboard** (UI-D12, layout from the user's reference, more colourful):
1. Greeting ("Good morning, {name}"), search, and a primary button: Open letter workspace.
2. **Overview**: four tinted tiles, each with an icon, a value, and change vs last cycle (Applications · Interviewed ·
   Letters sent · Final-years not yet completed), plus a **letter outcomes donut** (Accepted / Awaiting reply / Declined).
3. **Work queues** (the D27 to-do): coloured chips with counts that open each queue: Applications to interview ·
   Organisations to check · Letters ready · Acceptances to confirm · Missing completion documents · Ready to
   complete (Head).
4. **Insights**: bar charts, each with a one-line takeaway written from the data and a Show table toggle:
   - Applications by **programme**, switchable between *Applications*, *Participation rate* (applied ÷ registered
     students in that programme, using the registry import) and *Placement rate* (accepted ÷ applied). Sorted, with
     values at the bar tips.
   - Applications by level (columns).
   - Applications per week across the window (line with crosshair tooltip).
   - Top host organisations by accepted students.
5. **Acceptances to confirm** table with ✓ Confirm / ✕ Not valid chips.
6. Three lists: Organisations to check · Letters ready · Awaiting company reply for more than 14 days.

Chart rules (dataviz method): validated categorical palette (blue, orange, aqua, magenta, violet; checked against the
light and dark surfaces); one hue per single-series chart; bars at most 24 px thick with 4 px rounded ends; a hover and
keyboard-focus tooltip on every mark; a table view for every chart; text in text colours, never in series colours.

**T2 Students**: table (name, programme, level, stage badge, organisation, registry flag) with search and filters.
Detail page: profile, CV (download is audit-logged), applications, placements, letters.

**T3 Applications**: table by status. Detail page: ranked choices, motivation, CV, then the **Interview outcome** form
(date, Pass / Not recommended, matched organisation [choices first, then any Active], notes) → [Save outcome].
Plus [Admit late application] (enter the student).

**T4 Organisations**: list (status filter) + [Add organisation]. **Check queue**: proposal details, duplicate
suggestions, [Approve] [Merge into…] [Reject (reason)].

**T5 Letters workspace** (UI-D6)
```
┌ Ready to send (31) ───────┬ Preview (white paper) ─────────┐
│ ☑ MTN Ghana · 4 students  │ [Uni letterhead]               │
│ ☑ Ecobank   · 2 students  │ Ref CS/INT/2026/0143 · 5 Nov   │
│ ☐ GHS Accra · 1 student   │ The HR Manager, MTN Ghana …    │
│ ⚠ Org X · no email        │ … Ama K. (Computer Sci, L300)  │
│                           │ Period 1 Jun – 31 Aug 2026     │
│ [Edit group] [Download]   │ [President signature]          │
│ [Mark sent]               │ Attachments: 4 CVs · 3.1 MB    │
├───────────────────────────┴────────────────────────────────┤
│ [Send selected (2)]   ██████░░░░  1 of 2 sent · 0 failed   │
└────────────────────────────────────────────────────────────┘
```
Tabs: Ready · Sent · Failed. Blocking banners: no approved template (BR4), past cut-off (BR5), over 20 MB,
Gmail daily limit close.

**T6 Placements**: tabs for Acceptances to confirm (view the acceptance letter → [Confirm] / [Not valid]), Declined /
needs re-match (→ re-match), Completion (report ✓/✗, evaluation form ✓/✗ + [Upload evaluation form]),
*[Mark Completed] (Head)*.

**T7 Reports**: Pipeline (count cards + a simple bar chart), Graduation status (table, filters by programme, level and
status) · [Export CSV]. R2: organisation, programme and sector.

## Head settings
**H1 Staff accounts**: list, [Invite staff / Head / President], deactivate.
**H2 Template** (D37): three steps. ① **Upload** (drop zone: .docx / Google Docs export / PDF). ② **Edit** in a
Word-like editor (bold, alignment, lists, tables; [Insert field] menu with no student ID; [Signature] block) with a
"Ready to send" checklist (reference, organisation, students, signature). ③ [Send to President]. Also: [Preview with
sample data], [Upload a different file], version list with source file name and statuses, remarks banner, signature
image upload (OQ3).
**H3 Cycles**: list + form (window, cut-off, default period).
**H4 Registry import**: upload CSV → preview (new / updated / error rows) → [Import].
**H5 Audit trail** *(proposed)*: filterable log.

## President (1)
**PR1 Template review**: a letter preview filled with sample data · version number and what changed · [Approve] ·
[Reject with remarks] (text area) · history of decisions. Nothing else appears in the navigation.

## Responsive rules
- Student pages: one column, 360 px minimum, buttons at least 44 px tall, the main action fixed at the bottom on long pages.
- Staff pages: sidebar collapses below 1024 px. Tables scroll inside their own container. The letter workspace stacks
  the preview below the list below 1024 px.
