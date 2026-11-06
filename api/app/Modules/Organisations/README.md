# Organisations module

**Responsibility:** Organisation list, student proposals (search first), check queue (approve / merge / reject with reason), duplicate warnings.

**Requirements:** FR-O1–O5 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Organisations/`, one Pest feature test per business rule and per permission row (AD17).
