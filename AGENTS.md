# AGENTS.md

Quick guidance for coding agents working in this repository.
Keep this file short and actionable; use linked docs for details.

## Product Direction

- Prefer low-friction workflows and low-maintenance implementations.
- Prefer pragmatic security controls that reduce real risk; avoid unnecessary complexity by default.

## Read This First

- Documentation map: [docs/index.md](docs/index.md)
- Local setup and daily flow: [docs/development.md](docs/development.md)
- Environment and deployment constraints: [docs/environment.md](docs/environment.md), [docs/deployment-and-release.md](docs/deployment-and-release.md)
- Testing strategy: [docs/testing.md](docs/testing.md)
- Architecture references: [docs/backend-architecture.md](docs/backend-architecture.md), [docs/frontend-architecture.md](docs/frontend-architecture.md), [docs/data-model.md](docs/data-model.md)
- Security and permissions: [docs/security-and-permissions.md](docs/security-and-permissions.md), [shared/permission-contract.ts](shared/permission-contract.ts)

## Canonical Commands

Run from repo root unless stated otherwise.

- Install all dependencies: `npm install`
- Start full local stack: `npm run dev`
- Build all: `npm run build`
- DB migrate/seed/reset: `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`
- SQLite operations bundle: `npm run db:ops`
- Backend only: `npm --prefix backend run start:dev:migrate`
- Frontend only: `npm --prefix frontend run dev`

## Architecture Boundaries

- Backend is modular by domain under `backend/src/*` (`auth`, `patients`, `encounters`, `consents`, etc.).
- Keep controllers thin; business rules belong in services.
- Shared cross-cutting backend logic belongs in `backend/src/common/*` (guards, decorators, filters, helpers).
- Frontend routes use Next.js App Router under `frontend/src/app/*`; private app shell lives in `frontend/src/app/(dashboard)/layout.tsx`.
- Shared FE/BE permission intent lives in `shared/permission-contract.ts` (backend remains source of truth for enforcement).

## Non-Obvious Gotchas

- Browser calls must stay same-origin via `/api` rewrite. Do not switch frontend browser traffic to direct backend origins unless explicitly requested.
- `frontend/src/app/page.tsx` does not inherit the `(dashboard)` layout automatically.
- `backend/test/app.e2e-spec.ts` is stateful/sequential. Run the full file, do not filter by `--testNamePattern`.
- Playwright starts frontend; tests that hit real `/api` need backend available on `:5678`.
- Manual source files should stay <=300 lines when possible; 500 lines is a hard limit.

## Validation Matrix

- Backend-only changes:
  - `npm --prefix backend run typecheck`
  - `npm --prefix backend run test`
- Frontend-only changes:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test`
- Contracts/auth/permissions/encounters or cross-layer changes:
  - `npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts`
  - `npm --prefix frontend run test`
  - `npm --prefix frontend run test:e2e` when route/auth UX is affected

## Key Implementation References

- Backend bootstrap and safety checks: `backend/src/main.ts`
- Backend auth guard/decorators pattern: `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/common/decorators/current-user.decorator.ts`
- Frontend session gatekeeping: `frontend/src/proxy.ts`
- Frontend API auth-refresh flow: `frontend/src/lib/api.ts`
- Frontend auth/permission client state: `frontend/src/stores/auth-store.ts`
