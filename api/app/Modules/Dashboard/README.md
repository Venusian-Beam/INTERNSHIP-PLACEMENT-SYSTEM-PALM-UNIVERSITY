# Dashboard module

**Responsibility:** Staff work-queue counts and the insight dashboard data (programme, level, weekly, organisation charts).

**Requirements:** FR-D1, FR-R6 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Dashboard/`, one Pest feature test per business rule and per permission row (AD17).
