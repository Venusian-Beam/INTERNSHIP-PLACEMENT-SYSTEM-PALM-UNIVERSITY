# Files module

**Responsibility:** Presigned upload/download URLs (Neon Object Storage, S3 driver), file metadata, type/size checks, permission-checked access, download audit. Files never stream through the API (Vercel 4.5 MB limit).

**Requirements:** FR-X3 (see docs/03-functional-requirements.md)

**Release:** R1

Layout: `Http/Controllers` (thin) · `Http/Requests` (validation) · `Actions` (one business operation per class; business rules live here) · `Models` · `Policies` (role and ownership checks; every action is authorised on the server, NFR-S1).
Tests: `tests/Feature/Files/`, one Pest feature test per business rule and per permission row (AD17).
