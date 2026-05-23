# Architecture Decision Record: Tenant/Clinic Model

**Status:** Superseded / Historical
**Date:** 2026-05-04  
**Superseded by:** current product constraint documented in
`docs/deployment-and-release.md` and `docs/environment.md`.

## Context

Anamneo originally evaluated multi-clinic SaaS deployment strategies. The
current production beta does **not** support multi-tenant operation. It supports
one clinic per deployed instance, with an isolated PostgreSQL database, uploads
directory and backup set.

## Current Decision

- `ANAMNEO_DEPLOYMENT_SCOPE=single-clinic` is required in production.
- The backend rejects unsupported production scopes, including `multi-tenant`.
- PostgreSQL is the only runtime database engine.
- Each clinic that needs production isolation must run a separate instance until
  a first-class `Clinic/Tenant` model exists.

## Future Multi-Tenant Direction

Before multiple clinics can share one deployed instance, the product needs:

- A `Clinic` or `Tenant` data model.
- Required tenant ownership on users, patients, encounters, audit logs and other
  clinical entities.
- Backend guards and query filters that enforce tenant isolation.
- Tests proving cross-tenant IDOR attempts fail.
- Migration and rollback procedures for existing single-clinic data.

The likely implementation is a single PostgreSQL database with tenant-scoped
rows and strict application enforcement, optionally complemented by PostgreSQL
features such as row-level security if the risk model requires it.

## References

- [Environment](../environment.md)
- [Deployment and Release](../deployment-and-release.md)
- [Security and Permissions](../security-and-permissions.md)
