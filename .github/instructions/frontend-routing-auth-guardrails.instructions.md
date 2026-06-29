---
name: Frontend Routing And Auth Guardrails
description: "Use when editing Next.js App Router pages and layouts, auth and session flow, API client calls, or permission-gated UI in frontend."
applyTo:
  - frontend/src/**/*.ts
  - frontend/src/**/*.tsx
---

# Frontend Routing And Auth Guardrails

- Keep browser API traffic on same-origin /api rewrite unless a task explicitly requires otherwise.
- Remember frontend/src/app/page.tsx does not inherit frontend/src/app/(dashboard)/layout.tsx automatically.
- In Next.js App Router, client components can prerender during build. Move router, window, and location side effects to useEffect.
- Keep auth and session behavior aligned with frontend/src/proxy.ts and frontend/src/lib/api.ts.
- Treat frontend permission checks as UX hints only; backend remains the security enforcement layer.
- For next-intl namespace objects, avoid literal dots in key names; use nested keys instead.
- Respect file-size guardrails: target <=300 lines and keep 500 as hard limit for handwritten files.

Minimum validation:

- Frontend changes: npm --prefix frontend run typecheck && npm --prefix frontend run test
- Route, auth, or session UX changes: npm --prefix frontend run test:e2e

Reference docs:

- docs/frontend-architecture.md
- docs/development.md
- docs/testing.md
- docs/security-and-permissions.md
