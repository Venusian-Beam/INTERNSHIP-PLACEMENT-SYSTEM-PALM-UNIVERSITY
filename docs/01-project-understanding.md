# 01 · Project Understanding

## The problem
The university's Career Services helps students find internships. An internship is required to graduate (F12), and
100 to 500 students take part each year (F23). Today the process runs on a Google Form, one-on-one interviews, Word
letters typed by hand, and email (F1–F9).

The one thing that confirmed hurts is **letter production** (F21). Each introductory letter is typed by hand, which is
slow and leads to wrong names or wrong companies. It is then emailed with CVs attached one at a time (F22). Signing is
not the problem: the President's signature is already on file and only the letter design needs approval (F28).

Two smaller needs fall out of the same records (G5, F24): Career Services wants to see **where every student is** in the
process, and to produce the **graduation check** (who has completed the internship requirement) easily.

## Objectives
1. Produce a correct introductory letter, including group letters and attachments, **in minutes** (F24-1).
2. Remove name and company errors by **filling letters automatically from records** (F24-2, R3).
3. Let Career Services see **every student's stage** at any time (F24-3).
4. Make the **graduation-completion list** easy to produce, including students who never applied (F24-4, D30).

## The proposed solution
A web application where:

- **Students** register with their university email, apply during the cycle's window with up to 3 ranked organisation
  choices, propose organisations that aren't listed, record what the company replied, and upload documents. They can
  see their own sent letter.
- **Career Services staff** record interview outcomes and matches, check organisations that students propose, produce
  letters grouped by organisation from one approved template, and send them by email with the students' CVs attached.
  They track acceptances and completion through a to-do dashboard.
- **The Career Services Head** also manages staff, cycles, the registry import and the letter template, and gives the
  final "Completed" sign-off.
- **The President** approves the letter template once per version. Approved letters carry the signature on file.

Companies **do not** get accounts. They receive emails and reply outside the system (F8, F10).

## Scope

| In scope (Release 1, D35) | Deferred (Release 2, D35) | Out of scope |
|---|---|---|
| Registration and roles; applications; organisation list and checks; interview outcomes; template approval; letters (generate, group, send, download); acceptance; completion; to-do dashboard; event emails; pipeline and graduation reports; registry import | Upload reminders; organisation report; programme/sector report; automatic deletion of old data | Company accounts; automatic matching (D28); interview booking (D15); supervising students during the internship, logbooks, grading (F13, F18); public letter verification (D34); "opportunity" listings (D10) |

## Key distinctions
- **Introductory letter**: issued by the university and signed by the President, introducing the student(s) to a company.
  The system **produces** it.
- **Acceptance letter**: issued by the company to accept a student. The system only **stores** it, after the student or
  Career Services uploads it (BR7).
- **Evaluation form**: completed by the company at the end of the internship and emailed to Career Services, which
  uploads it (F17, D21).

## Constraints
- The two-app structure (Next.js + Laravel) is fixed (AD1). It runs on Vercel and Neon, with free tiers wherever
  possible (F34, AD5′).
- Ghana's Data Protection Act, 2012 (Act 843) applies (F36). Real pilot data will be in production (AD9).
- Students mostly use phones; staff mostly use desktops (D32).
