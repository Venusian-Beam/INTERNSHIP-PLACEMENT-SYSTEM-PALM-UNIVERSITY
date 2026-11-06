# Cycles module

**Responsibility:** Cycles, application window and letter cut-off enforcement, default internship period (Head only).

**Requirements:** FR-C1–C3 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Cycles/`, one Pest feature test per business rule and per permission row (AD17).
