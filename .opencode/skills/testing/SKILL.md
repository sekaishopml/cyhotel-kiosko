---
name: testing
description: Use when adding tests, debugging regressions, validating API contracts, or preparing a release of CyHotel.
---

# Testing CyHotel

- Test business rules independently from HTTP and database wiring where practical.
- Cover authentication scope, order transitions, pricing, idempotency, and validation.
- For database changes, verify RLS with a valid hotel, an unknown hotel, and cross-tenant writes.
- For kiosk changes, run the production frontend build and check the service worker and offline path.
- Report commands run and distinguish unavailable infrastructure from failed tests.
- Never skip a failing test silently; either fix it or document the blocker.
