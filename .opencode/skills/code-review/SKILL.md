---
name: code-review
description: Use when reviewing a diff, release, refactor, security change, or architecture change without modifying files.
---

# Senior Review CyHotel

Review findings first, ordered by severity. Look for:

- contract or behavior regressions;
- authentication, authorization, RLS, secrets, and tenant isolation issues;
- race conditions, transaction and idempotency errors;
- production availability and offline-mode regressions;
- unnecessary coupling, duplication, or architecture drift;
- missing tests, migrations, OpenAPI updates, ADRs, or operational verification.

Reference exact `file:line` locations. Do not edit files during review.
