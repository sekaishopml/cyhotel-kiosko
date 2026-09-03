---
name: kiosco
description: Use when changing web/kiosco, the tablet check-in UI, PWA caching, offline queue, branding, or kiosk-to-API behavior.
---

# Kiosco CyHotel

- Preserve offline-first behavior and the local APK fallback.
- Design for an 8-inch tablet, older guests, large touch targets, and no accidental scroll.
- Use the approved white, green, and bronze palette from `docs/brand/DECISION.md`.
- Keep API calls relative and compatible with the public kiosk endpoints.
- After a frontend build, verify the generated asset and service-worker versions.
- Do not copy `dist` into Docker; the compose bind mount makes `npm run build` sufficient.

Relevant references: `README.md`, `docs/ARCHITECTURE.md` ADR-005, `android-shell/`.
