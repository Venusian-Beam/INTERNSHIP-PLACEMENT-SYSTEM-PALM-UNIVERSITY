# Identity module

**Responsibility:** Registration (university email + verification), login, emailed one-time codes for staff/Head/President, password reset, invites, roles, rate limits, privacy-notice consent.

**Requirements:** FR-A1–A8 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Identity/`, one Pest feature test per business rule and per permission row (AD17).
