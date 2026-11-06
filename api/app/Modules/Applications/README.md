# Applications module

**Responsibility:** Application wizard drafts, one per cycle, late admission, interview outcome, manual matching (never suggested).

**Requirements:** FR-P1–P7 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Applications/`, one Pest feature test per business rule and per permission row (AD17).
