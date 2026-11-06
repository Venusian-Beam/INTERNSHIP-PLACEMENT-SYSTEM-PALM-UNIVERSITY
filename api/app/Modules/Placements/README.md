# Placements module

**Responsibility:** Placement lifecycle, company replies, acceptance confirmation, re-match loop, completion documents, Head marks Completed.

**Requirements:** FR-PL1–PL6 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Placements/`, one Pest feature test per business rule and per permission row (AD17).
