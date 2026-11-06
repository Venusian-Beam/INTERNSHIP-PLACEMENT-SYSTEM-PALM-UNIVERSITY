# Students module

**Responsibility:** Student profiles, CVs, registry CSV import and account linking by university email, expected graduation year.

**Requirements:** FR-S1–S4 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Students/`, one Pest feature test per business rule and per permission row (AD17).
