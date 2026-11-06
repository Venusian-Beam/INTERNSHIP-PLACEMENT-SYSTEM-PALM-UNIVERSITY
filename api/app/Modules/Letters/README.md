# Letters module

**Responsibility:** Template versions + President approval, grouping by organisation, PDF rendering (dompdf), signature, reference numbers, SMTP send / mark sent, send log. Sent letters can't be changed.

**Requirements:** FR-T1–T5, FR-L1–L11 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Letters/`, one Pest feature test per business rule and per permission row (AD17).
