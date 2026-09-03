---
name: backend
description: Use when changing backend/server.py, backend/app, API routes, services, authentication, orders, rooms, housekeeping, or worker behavior.
---

# Backend CyHotel

- Preserve the stdlib `ThreadingHTTPServer` architecture unless an ADR approves a change.
- Keep HTTP parsing and response formatting in routes/handlers; keep business rules in `backend/app/services`.
- Preserve `docs/api_contract_v2.md` and `backend/openapi.yaml`.
- Use the authenticated session for staff identity; never trust `staff_user` from request bodies.
- Keep idempotency and state-machine transitions transactional.
- Run focused Python checks and API smoke tests after changes.
- Check concurrency, connection-pool use, error responses, and audit logging.

Relevant references: `docs/ARCHITECTURE.md`, `docs/api_contract_v2.md`, `backend/openapi.yaml`.
