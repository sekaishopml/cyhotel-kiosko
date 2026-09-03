---
name: database
description: Use when changing backend/db.py, PostgreSQL schema, RLS policies, indexes, migrations, sessions, backups, or database access.
---

# Database CyHotel

- Treat PostgreSQL as the source of truth and preserve tenant isolation.
- Runtime queries must use the non-superuser `cyhotel_app`; reserve the superuser for initialization and migrations.
- Every tenant table needs correct `USING` and `WITH CHECK` RLS behavior.
- Prefer additive, idempotent migrations with explicit verification and rollback notes.
- Check indexes for hot filters and avoid unbounded queries in operational endpoints.
- Never expose secrets from `.env`, `keys/`, or database connection strings.

Relevant references: `docs/ARCHITECTURE.md` ADR-003, `docs/rls-fix.patch`, `README-INFRA.md`.
