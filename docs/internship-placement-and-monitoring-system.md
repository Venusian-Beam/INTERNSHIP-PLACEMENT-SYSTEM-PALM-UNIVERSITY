# University Internship Placement and Monitoring System

**Palm University College · Career Services Directorate**  
*System Architecture & Functional Implementation Specification*

---

## 1. Executive Summary

The **Palm University Internship Placement and Monitoring System** is a unified, web-based platform designed to manage the end-to-end lifecycle of undergraduate and postgraduate experiential learning. Built on a decoupled architecture comprising a Laravel 11/PostgreSQL RESTful API backend and a Next.js 15/Tailwind CSS frontend, the system orchestrates the complete transition of students from registry enrollment to verified graduation clearance.

The platform provides role-governed workflows for five primary actor classes:
1. **Students**: Manage profiles, search opportunities, submit ranked preferences, track progress, log weekly activities, and upload deliverables.
2. **Career Services Staff**: Coordinate institutional cycles, audit partner organizations, review applications, execute algorithmic matching, dispatch signed introduction letters, and verify placements.
3. **Workplace (Industry) Supervisors**: Monitor onsite attendance, review logbooks, and submit structured milestone and final performance evaluations.
4. **Academic Supervisors**: Conduct institutional monitoring, assess student internship reports, and grade placement outcomes.
5. **Head of Career Services & University Leadership**: Oversee macro analytics, approve letter templates, manage audit trails, and certify degree fulfillment.

---

## 2. Core Functional Modules

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        PALM INTERNSHIP PLACEMENT SYSTEM                           │
├─────────────────┬──────────────────┬─────────────────┬────────────────────────────┤
│ 1. Profiles     │ 2. Opportunities │ 3. Applications │ 4. Matching & Confirmation │
│ • Students      │ • Listings       │ • Multi-choice  │ • Multi-factor algorithm   │
│ • Organizations │ • Criteria/Quota │ • CV & Statement│ • Letter batch dispatch    │
│ • Supervisors   │ • Geolocation    │ • Cycle gating  │ • Acceptance verification  │
├─────────────────┼──────────────────┼─────────────────┼────────────────────────────┤
│ 5. Monitoring   │ 6. Supervision   │ 7. Evaluation   │ 8. Analytics & Reports     │
│ • Weekly logs   │ • Industry & Uni │ • Rubric forms  │ • Accreditation reports    │
│ • Attendance    │ • Site visits    │ • Rating scores │ • Graduation clearance     │
│ • Milestones    │ • Feedback loop  │ • Student reports│ • Sector & geo telemetry  │
└─────────────────┴──────────────────┴─────────────────┴────────────────────────────┘
```

### 2.1. Student Internship Profiles
- **Registry Integration**: Automatically linked to institutional student records via matriculation ID, pre-populating student number, degree programme, year/level, and expected graduation cohort.
- **Competency & Career Dossier**: Students maintain technical and soft skill tags, career interest sectors, geographic preferences (e.g., Greater Accra, Western, Ashanti, remote), and upload standardized PDF curriculum vitae.
- **Compliance Tracking**: Real-time display of application cycle status, document validation indicators, and academic clearance markers.

### 2.2. Organization Profiles
- **Enterprise Repository**: Verified profiles of corporate, public-sector, and NGO partners containing industry sector, physical/digital address, corporate contacts, and accreditation credentials.
- **Student-Proposed Queue**: Controlled vetting pipeline where student-submitted host organizations undergo automated duplicate detection, sanction scanning, and staff compliance checks before approval.
- **Engagement History**: Historical records of previous cohorts hosted, intake capacities, retention rates, and supervisor ratings.

### 2.3. Internship Opportunities
- **Structured Offerings**: Host institutions publish discrete internship openings tagged by degree discipline, technical prerequisites, intake limits, location, and compensation/stipend terms.
- **Targeted Visibility**: Openings can be made universally visible or restricted to specific cohorts (e.g., Level 300 Computer Science or Final Year Accounting).

### 2.4. Applications Engine
- **Cyclical Application Windows**: Enforcement of hard opening dates, closing deadlines, and late-admission exceptions governed by academic council calendars.
- **Prioritized Ranking**: Students submit up to three ranked choices or link an approved student-proposed organization.
- **Draft Persistence**: Multi-step autosaving wizard capturing student details, organizational selections, targeted career motivations, and verified CV attachments.

### 2.5. Algorithmic Placement-Matching Mechanism
The platform incorporates an automated, multi-criteria recommendation and matching engine that optimizes placements prior to interview scheduling and introductory letter generation.

The match compatibility score \(S_{m}\) between student \(s\) and host opening \(o\) is computed as:

\[
S_{m} = w_{p} \cdot P(s, o) + w_{s} \cdot K(s, o) + w_{l} \cdot L(s, o) + w_{i} \cdot I(s, o) + w_{r} \cdot R(s, o)
\]

Where:
- **Programme Alignment (\(P\), 30%)**: Verification that student academic specialization matches the organization's discipline requirements.
- **Skills Match (\(K\), 25%)**: Jaccard similarity coefficient between student skill tags (e.g., Python, Financial Modeling, Clinical Nursing) and organizational opportunity requirements.
- **Geographic Proximity (\(L\), 15%)**: Alignment between student residential/logistical preference and organization site or remote status.
- **Student Interest & Motivation (\(I\), 15%)**: Weighted scoring based on the student's ranked preference (Choice 1 vs 2 vs 3) and sector alignment.
- **Organization Intake & Quota (\(R\), 15%)**: Capacity constraints ensuring balanced cohort distribution and preventing over-allocation.

Staff review scored recommendations with full override authority, facilitating final match confirmation.

### 2.6. Placement Confirmation & Formal Dispatch
- **Automated Introductory Letters**: Dynamic batch generation of legally binding university introduction letters using approved dompdf templates bearing the University President’s encrypted digital signature.
- **Student Privacy Protection**: Institutional letters group students per company without exposing confidential student matriculation numbers.
- **Two-Way Reply Auditing**: Tracking company responses with secure student/staff upload of official acceptance letters, followed by Career Services verification.

### 2.7. Dual Supervisor Assignment
- **Workplace (Industry) Supervisor**: Host organizations register a designated mentor responsible for day-to-day oversight, logbook sign-offs, and workplace evaluations.
- **Academic (Faculty) Supervisor**: Departmental coordinators assign faculty supervisors to monitor clusters of students geographically or by specialization.
- **Direct Engagement Channel**: Contact details, visit schedules, and communication histories are logged in the student's placement dossier.

### 2.8. Internship Progress Tracking & Digital Logbook
- **Periodic Activity Logs**: Students record weekly task completions, learning outcomes, and workplace reflections.
- **Supervisor Verification**: Workplace supervisors receive digital validation prompts to sign off on submitted hours and activities.
- **Early-Warning Telemetry**: Automated alerts flag students with unverified logs, overdue reports, or absentee warnings.

### 2.9. Comprehensive Evaluation System
- **Industry Assessment Form**: Standardized evaluation rubric completed by the workplace supervisor assessing punctuality, technical competence, initiative, teamwork, and overall performance.
- **Academic Internship Report**: Mandatory post-internship analytical paper uploaded by the student for faculty grading.
- **Clearance Sign-Off**: Multi-tier sign-off requiring both reports before the Head of Career Services marks the student’s degree internship requirement as **"Completed"**.

### 2.10. Placement Reports & Institutional Analytics
- **Live Pipeline Dashboards**: Real-time telemetry tracking cohort progression across stages (Not Started \(\rightarrow\) To Interview \(\rightarrow\) Matched \(\rightarrow\) Letter Sent \(\rightarrow\) Accepted \(\rightarrow\) Completed).
- **Accreditation & Audit Reporting**: Instant CSV/PDF exports detailing participation by academic programme, sector distribution, host company conversion rates, and gender breakdown.
- **Graduation Clearance Audit**: Automated registry cross-referencing highlighting final-year students (Level 400+) at risk of missing graduation deadlines due to incomplete internships.

---

## 3. Database Architecture (Entity Relationships)

```
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│      User       │1     1│ StudentProfile  │1     *│      Application       │
├─────────────────┤◄─────►├─────────────────┤◄─────►├────────────────────────┤
│ id              │       │ id              │       │ id                     │
│ email           │       │ student_number  │       │ cycle_id               │
│ role            │       │ programme       │       │ status                 │
│ is_active       │       │ level           │       │ motivation             │
└─────────────────┘       │ cv_file_id      │       │ interview_date         │
                          └────────┬────────┘       └───────────┬────────────┘
                                   │1                           │1
                                   │                            │
                                   │*                           │*
                          ┌────────┴────────┐       ┌───────────┴────────────┐
                          │    Placement    │*     1│   ApplicationChoice    │
                          ├─────────────────┤◄──────├────────────────────────┤
                          │ id              │       │ organisation_id        │
                          │ organisation_id │       │ rank (1..3)            │
                          │ letter_id       │       └────────────────────────┘
                          │ status          │
                          │ ind_supervisor  │       ┌────────────────────────┐
                          │ acad_supervisor │*     1│      Organisation      │
                          │ report_file_id  │◄──────├────────────────────────┤
                          │ eval_file_id    │       │ id, name, sector       │
                          │ logbook_data    │       │ address, email, phone  │
                          └─────────────────┘       │ status (active/pending)│
                                                    └────────────────────────┘
```

---

## 4. Security & Compliance Implementation

1. **Role-Based Access Control (RBAC)**: Enforced via Laravel middleware (`EnsureRole:student,staff,head,president`) and Next.js server guards.
2. **Data Protection Compliance**: Full adherence to the Ghana Data Protection Act, 2012 (Act 843), with mandatory consent capture, encrypted personal identifying information, and automated document retention schedules (deletion 2 years post-graduation).
3. **Multi-Factor Authentication**: Privileged roles (Staff, Head, President) require 6-digit cryptographic email OTP challenges prior to session establishment.
4. **Secure Document Pipeline**: All uploads (CVs, acceptance letters, signed evaluation forms) are validated for MIME-type and scanned, served only through time-limited presigned URLs with download access auditing.

---

## 5. Current Implementation Matrix

| Specified Requirement | Implementation Status | Technical Component in Codebase |
|---|---|---|
| **Student Internship Profiles** | **Active & Integrated** | `App\Modules\Students`, `StudentProfile.php`, `/student/profile` |
| **Organization Profiles** | **Active & Integrated** | `App\Modules\Organisations`, `Organisation.php`, `/staff/organisations` |
| **Internship Opportunities** | **Active & Integrated** | `OrganisationController.php`, Directory search, Proposal workflow |
| **Applications Engine** | **Active & Integrated** | `App\Modules\Applications`, 5-step wizard, `/student/apply` |
| **Placement Confirmation** | **Active & Integrated** | `App\Modules\Placements`, Verification modal, `/staff/placements` |
| **Supervisor Assignment** | **Active & Integrated** | `Placement.php` supervisor relations, Industry contact mapping |
| **Internship Progress Tracking** | **Active & Integrated** | `PlacementController.php`, Activity log review, Stage telemetry |
| **Evaluation Management** | **Active & Integrated** | `FileUpload.tsx`, Evaluation form capture, Report verification |
| **Placement Reports & Exports** | **Active & Integrated** | `App\Modules\Reports`, Real-time SVG charts, Formula-safe CSV export |
| **Placement-Matching Mechanism** | **Active & Integrated** | Multi-factor matching engine based on Programme, Sector & Ranking |

---

## 6. Seeded Demo Accounts & Credentials

All seeded accounts in the development environment use the shared default password:
> **Default Password for All Accounts:** `Placement2026!`

### 6.1. Student Accounts (Various Workflow Stages)

| Name | Email | Password | Programme & Level | Current Stage / Test Scenario |
|---|---|---|---|---|
| **Kweku Mensah** | `demo.student@st.university.example` | `Placement2026!` | Computer Science (L300) | **Fresh / Not Started**: Has 0 applications. Use this account to experience the full 5-step application wizard from scratch. |
| **Ama Mensah** | `ama.mensah@st.university.example` | `Placement2026!` | Computer Science (L300) | **Matched / Letter Pending**: Interview passed; matched with *Volta Telecom Ltd*; ready for batch letter generation. |
| **Kofi Boateng** | `kofi.boateng@st.university.example` | `Placement2026!` | Computer Science (L200) | **Matched / Letter Pending**: Interview passed; paired on the same letter to *Volta Telecom Ltd*. |
| **Akosua Darko** | `akosua.darko@st.university.example` | `Placement2026!` | Nursing (L300) | **Matched**: Interview passed; matched with *Korle Health Services*. |
| **Yaw Asante** | `yaw.asante@st.university.example` | `Placement2026!` | Economics (L200) | **Submitted / To Interview**: Application submitted for *Coastal Bank Ghana*; awaiting staff interview scheduling. |
| **Esi Owusu** | `esi.owusu@st.university.example` | `Placement2026!` | Agriculture (L400) | **Submitted / Proposed Org**: Applied to *Ashanti Agro Ltd* and proposed a custom organisation (*Kasoa Fresh Foods*) pending check. |

### 6.2. Administrative & Executive Accounts

| Name | Email | Password | Role | Key Functions & Responsibilities |
|---|---|---|---|---|
| **Akua Boateng** | `head@careers.example` | `Placement2026!` | **Head of Career Services** | Full management authority: cycles, staff accounts, registry import, letter template creation, audit logs, and final completion sign-off. |
| **Kwabena Owusu** | `staff@careers.example` | `Placement2026!` | **Career Services Staff** | Day-to-day operations: interview outcome recording, checking proposed organisations, batch dispatching letters, and verifying acceptance letters. |
| **Office of the President** | `president@careers.example` | `Placement2026!` | **University President** | Institutional review: inspects preview versions of letter templates and issues formal digital sign-off / approval. |

> **Two-Factor Authentication (OTP) Note for Staff Roles:**  
> Privileged accounts (`head`, `staff`, `president`) trigger a 6-digit email verification code upon login. In local development (`APP_ENV=local`), the active code automatically populates in the on-screen development helper banner above the form (and is also recorded to `/api/dev/mail`).

