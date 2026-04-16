---
name: cross-layer-regression-check
description: "Run a pragmatic regression check when changes touch frontend-backend contracts, auth, permissions, encounters, consents, alerts, or shared workflows. Use before merge and during risk triage."
argument-hint: "Describe changed areas, for example: auth + encounters + consents"
user-invocable: true
---

# Cross-Layer Regression Check

Use this skill when a change can break behavior across backend and frontend.

## Inputs

- Current workspace diff
- Optional user argument describing changed areas

## Procedure

1. Classify change scope.

- Backend only
- Frontend only
- Cross-layer (contract, auth, permissions, encounters, consents, alerts)

2. Run the minimum validation matrix.

- If backend files changed:
  - npm --prefix backend run typecheck
  - npm --prefix backend run test
- If frontend files changed:
  - npm --prefix frontend run typecheck
  - npm --prefix frontend run test
- If cross-layer or high risk areas changed:
  - npm --prefix backend run test:e2e -- --runInBand --testPathPattern=app.e2e-spec.ts
  - npm --prefix frontend run test
  - npm --prefix frontend run test:e2e when route/auth/session UX changed

3. Interpret failures conservatively.

- Prioritize API contract drift and permission bypass findings.
- Treat missing access validation in clinical endpoints as high severity.
- Do not filter backend/test/app.e2e-spec.ts with --testNamePattern because it is stateful and sequential.

4. Report results.

- Findings first, ordered by severity with file references.
- Then open questions and assumptions.
- Then a short validation summary (what passed, failed, or was not run).

## Repo-specific notes

- Keep browser API traffic on same-origin /api rewrite.
- frontend/src/app/page.tsx does not inherit the dashboard layout automatically.

## References

- docs/testing.md
- docs/security-and-permissions.md
- docs/frontend-architecture.md
- docs/backend-architecture.md
