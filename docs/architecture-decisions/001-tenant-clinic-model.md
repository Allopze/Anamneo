# Architecture Decision Record: Tenant/Clinic Model

**Status:** Proposed  
**Date:** 2026-05-04  
**Context:** Anamneo needs to support multiple clinics/organizations (multi-tenant) for SaaS deployment.

## Problem Statement

Currently, Anamneo is a single-tenant application. All users, patients, and encounters exist in a shared namespace. To deploy as a SaaS product serving multiple clinics, we need to implement tenant isolation.

## Current State

The current schema has no tenant concept:
- `User` → no tenant affiliation
- `Patient` → no tenant affiliation  
- `Encounter` → no tenant affiliation
- All data is globally accessible to authenticated users

## Options Considered

### Option A: Single Database with Tenant ID (Recommended)

Add `tenantId` (or `clinicId`) to all major tables and enforce isolation at the application layer.

**Pros:**
- Simplest implementation with SQLite
- Single backup/restore process
- Easy to maintain and debug
- Low operational overhead
- Cross-tenant analytics possible (if needed)
- No changes to database infrastructure

**Cons:**
- Logical isolation only (not physical)
- Risk of data leakage if application logic fails
- All tenants share database resources
- Backup/restore is all-or-nothing

**Implementation:**
```prisma
model Clinic {
  id          String   @id @default(uuid())
  name        String
  rut         String?  @unique
  domain      String?  @unique  // Optional custom domain
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  users       User[]
  patients    Patient[]
  encounters  Encounter[]
  // ... other tenant-scoped entities
}

// Add to existing models:
model User {
  clinicId    String?  @map("clinic_id")  // Nullable for system admins
  clinic      Clinic?  @relation(fields: [clinicId], references: [id])
  // ...
}

model Patient {
  clinicId    String   @map("clinic_id")
  clinic      Clinic   @relation(fields: [clinicId], references: [id])
  // ...
}
```

### Option B: Database per Tenant

Each clinic gets its own SQLite database file.

**Pros:**
- Physical isolation (complete data separation)
- Easy backup/restore per tenant
- No risk of cross-tenant data leakage
- Can scale databases independently

**Cons:**
- Complex connection management
- Hard to maintain with many tenants
- Migration orchestration is complex
- No cross-tenant queries possible
- Higher operational overhead
- SQLite file locking issues with many databases

### Option C: Migrate to PostgreSQL with Schema per Tenant

Use PostgreSQL schemas to isolate each tenant.

**Pros:**
- Physical isolation within single database
- Easy backup/restore per tenant
- PostgreSQL features (row-level security, etc.)
- Better scalability

**Cons:**
- Major infrastructure change (SQLite → PostgreSQL)
- Requires PostgreSQL deployment and maintenance
- Loses SQLite simplicity and portability
- Significant migration effort
- Higher hosting costs

## Decision: Option A - Single Database with Tenant ID

### Rationale

1. **SQLite Compatibility**: Anamneo is designed around SQLite for simplicity and portability. Option A maintains this architecture.

2. **Implementation Complexity**: Option A requires minimal changes to the existing codebase and infrastructure.

3. **Operational Simplicity**: Single database means single backup, single migration, single monitoring setup.

4. **Sufficient Isolation**: For the target market (Chilean medical clinics), logical isolation with proper application-layer enforcement is sufficient.

5. **Future Flexibility**: If a tenant requires physical isolation later, we can migrate them to a separate database without changing the application logic.

### Implementation Plan

#### Phase 1: Database Schema Changes
1. Create `Clinic` model
2. Add `clinicId` to `User`, `Patient`, `Encounter`, and other tenant-scoped models
3. Create migration script
4. Add database indexes for `clinicId` columns

#### Phase 2: Application Layer Enforcement
1. Create `TenantGuard` middleware in NestJS
2. Update all services to filter by `clinicId`
3. Add `clinicId` to JWT tokens
4. Update Prisma queries to include `clinicId` filters

#### Phase 3: UI Changes
1. Add clinic selection during registration
2. Update admin panel to manage clinics
3. Add clinic context to dashboard
4. Update user invitations to include clinic affiliation

#### Phase 4: Testing & Validation
1. Write integration tests for tenant isolation
2. Test cross-tenant access attempts
3. Validate backup/restore with multi-tenant data
4. Performance testing with multiple tenants

### Security Considerations

1. **Middleware Enforcement**: All API endpoints must pass through `TenantGuard` that validates `clinicId` matches the user's clinic.

2. **Prisma Middleware**: Use Prisma middleware to automatically add `clinicId` filters to all queries.

3. **Audit Logging**: Log all access attempts with `clinicId` context for security auditing.

4. **System Admins**: Users with `isAdmin: true` and `clinicId: null` can access all tenants (for support purposes).

5. **Data Migration**: When adding `clinicId` to existing data, assign all current data to a default "legacy" clinic.

### Migration Strategy

```sql
-- 1. Create default clinic for existing data
INSERT INTO clinics (id, name, created_at, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Clinica Principal', datetime('now'), datetime('now'));

-- 2. Update existing users
UPDATE users SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;

-- 3. Update existing patients
UPDATE patients SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;

-- 4. Update existing encounters
UPDATE encounters SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
```

### Rollback Plan

If issues arise during migration:
1. Keep backup of pre-migration database
2. Maintain ability to run without `clinicId` enforcement temporarily
3. Feature flag for tenant isolation that can be disabled

## Alternatives Rejected

- **Option B (Database per Tenant)**: Rejected due to operational complexity and SQLite limitations with many database files.
- **Option C (PostgreSQL)**: Rejected because it requires major infrastructure changes and loses SQLite simplicity.

## References

- [Multi-Tenant Data Architecture](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/overview)
- [Prisma Multi-Tenant Guide](https://www.prisma.io/docs/guides/multi-tenant)
- [SQLite Limitations](https://www.sqlite.org/limits.html)
