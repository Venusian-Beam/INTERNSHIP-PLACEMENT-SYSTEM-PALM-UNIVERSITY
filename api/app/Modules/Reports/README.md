# Reports module

**Responsibility:** Pipeline, graduation status, by organisation, by programme/sector, CSV export.

**Requirements:** FR-R1–R5 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Reports/`, one Pest feature test per business rule and per permission row (AD17).
