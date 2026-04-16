---
name: Backend Domain Guardrails
description: "Use when editing backend NestJS domains, controllers, services, DTOs, Prisma contracts, auth, permissions, or encounter workflows."
applyTo:
  - backend/src/**/*.ts
  - backend/test/**/*.ts
---

# Backend Domain Guardrails

- Keep controllers thin: validate input, apply decorators and guards, then delegate business logic to services.
- Keep cross-cutting logic in backend/src/common instead of duplicating checks in each module.
- For clinical endpoints, validate effective patient and encounter access in backend logic. UI permissions are not enforcement.
- If an operation changes sensitive clinical state, preserve or add the audit logging path.
- Treat API response-shape changes as contract changes; align frontend consumers and tests in the same change when possible.
- Respect file-size guardrails: target <=300 lines and keep 500 as hard limit for handwritten files.

Minimum validation:

- Backend changes: npm --prefix backend run typecheck && npm --prefix backend run test
- Auth, permissions, encounters, consents, alerts, or contract-sensitive changes: npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts

Reference docs:

- docs/backend-architecture.md
- docs/security-and-permissions.md
- docs/testing.md
- docs/data-model.md
