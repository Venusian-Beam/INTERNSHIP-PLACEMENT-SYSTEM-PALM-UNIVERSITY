# 04 · Non-Functional Requirements

Targets marked *(proposed)* are engineering targets, not university policy. Confirm them at review.

## Security
| ID | Requirement | Source |
|---|---|---|
| NFR-S1 | Every API action is checked on the server by a role-and-ownership policy. Hiding a button in the interface doesn't count. | D5, AD8 |
| NFR-S2 | The browser never holds an API token. The Sanctum token lives in a `Secure; HttpOnly; SameSite=Lax` cookie on the Next.js domain, and the Next.js server forwards calls to Laravel. | AD8 |
| NFR-S3 | Staff, Head and President must enter an emailed one-time code: 6 digits, valid for 10 minutes *(proposed)*, single use, at most 5 attempts *(proposed)*. | AD15 |
| NFR-S4 | Rate limits on login, registration, code entry and password reset (e.g. 5 per minute per IP and per account *(proposed)*). | AD defaults |
| NFR-S5 | Passwords are hashed with Laravel's default (bcrypt/argon2). Minimum length 10 *(proposed)*. | — |
| NFR-S6 | Files are private. Uploads and downloads go through short-lived signed links (download ≤ 5 minutes *(proposed)*), issued only after a permission check. No public bucket. | AD6 |
| NFR-S7 | The President's signature image is never sent to any browser. It is only used inside the server when building PDFs. | AD defaults |
| NFR-S8 | Secrets (database URL, storage keys, Gmail app password) are stored only as Vercel or GitHub environment variables. They never go into the repository. | AD9 |
| NFR-S9 | Uploads are checked for type (PDF for CV, report, acceptance and evaluation; PNG for the signature), with a maximum of 4 MB per file *(proposed, keeps 3 CVs under the 20 MB email cap)*. | D19 |
| NFR-S10 | Audit log of the sensitive actions in FR-X1. Entries can't be changed through the application. | AD16 |

## Privacy (Ghana Data Protection Act, 2012, Act 843)
| ID | Requirement | Source |
|---|---|---|
| NFR-P1 | A privacy notice at registration states who controls the data (the university's Career Services), why it's collected (placement administration), what is collected, how long it's kept, and how to ask for access. | F36 |
| NFR-P2 | Collect only the fields in doc 09. Leave the student ID off letters. | D14 |
| NFR-P3 | Retention: graduation + 2 years, then delete documents and keep a minimal history (job in R2). | D33 |
| NFR-P4 | Data is stored in the EU. Neon and Vercel functions both run in **Frankfurt** (Neon `aws-eu-central-1`, Vercel `fra1`). Neither Neon nor Vercel offers an African region (verified). The cross-border transfer is documented for the data protection officer (OQ5). | AD13 |
| NFR-P5 | **Accepted risk AD12:** pilot emails go out from the owner's personal Gmail, so copies sit in that account's Sent folder. Disclose this to Career Services at pilot consent. Replace it with an official address as soon as one exists (OQ6). | AD12 |
| NFR-P6 | Preview and local environments use only fake seed data. Real data exists only in production. | AD9 |

## Usability and accessibility
| ID | Requirement | Source |
|---|---|---|
| NFR-U1 | Student screens work fully at 360 px width (phones first). Staff screens are designed for ≥ 1280 px and still usable on a tablet. | D32 |
| NFR-U2 | Meets WCAG 2.1 AA: contrast, keyboard access, visible focus, labelled inputs, problems explained next to each field. | UI defaults |
| NFR-U3 | Light and dark themes follow the device setting. Letter previews always render on white. | UI-D9 |
| NFR-U4 | Every screen has empty, loading and error states with a clear next action. | UI defaults |
| NFR-U5 | English only. | UI defaults |
| NFR-U6 | Brand colours are defined as theme settings in one file and can be swapped without code changes elsewhere. | UI-D1, UI-D4 |

## Performance *(proposed targets)*
| ID | Requirement |
|---|---|
| NFR-PF1 | Normal pages respond in under 1 second for a warm instance, measured on the server. The first request after idle (a cold start) can take longer. That's acceptable for a pilot of this size. |
| NFR-PF2 | Generating and sending one letter (PDF + CVs + SMTP) finishes in under 30 seconds. Each request stays well under Vercel's 300-second limit. |
| NFR-PF3 | Bulk sending 40 letters takes under 10 minutes (one request per letter, AD7). |
| NFR-PF4 | Designed for 500 applicants per cycle and several years of history without redesign (F23). |

## Reliability and recovery
| ID | Requirement | Source |
|---|---|---|
| NFR-R1 | Neon point-in-time restore (Free plan: **6 hours**, up to 1 GB of changes, verified) plus a nightly encrypted database dump via GitHub Actions, kept for 14 days. | AD14 |
| NFR-R2 | A restore test is carried out and documented before the pilot starts. | AD14 |
| NFR-R3 | A failed letter send never marks the letter Sent. Failures are visible and can be retried. | AD7 |
| NFR-R4 | Bulk email stays under Gmail's limit of **500 emails per day** (verified). If a day's sends would go over, the system warns. | AD4 |

## Maintainability and portability
| ID | Requirement | Source |
|---|---|---|
| NFR-M1 | One repository: `/web`, `/api`, `/docs`. An OpenAPI contract in `/docs` describes the API between Next.js and Laravel. | AD10 |
| NFR-M2 | Laravel ships as a standard Docker image that runs unchanged on Vercel or any Docker host, so it can be handed to university IT. | AD5′, F34 |
| NFR-M3 | Laravel is organised as one app split by feature (doc 08). No Vercel-specific code inside the business logic. | RA1 |
| NFR-M4 | CI on every PR runs Pest feature tests (BR1–BR8 and every role permission) and Playwright browser tests of the critical journeys. | AD17 |

## Cost
| ID | Requirement | Source |
|---|---|---|
| NFR-C1 | Runs on free tiers: Vercel Hobby, Neon Free (1 GB Postgres and 5 GB object storage per project, 100 CU-hours per month, 5 GB egress per month, verified), Gmail and GitHub Actions. | F34 |
| NFR-C2 | Neon Free allows only **10 branches per project** (verified). Preview branches are deleted automatically when a PR closes. | AD9 |
