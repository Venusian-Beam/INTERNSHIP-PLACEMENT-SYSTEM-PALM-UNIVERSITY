# Notifications module

**Responsibility:** Student event emails, email log, Gmail daily-limit counting. Upload reminders in R2.

**Requirements:** FR-N1–N3 (see docs/03-functional-requirements.md)

**Release:** R1 / R2

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Notifications/`, one Pest feature test per business rule and per permission row (AD17).
