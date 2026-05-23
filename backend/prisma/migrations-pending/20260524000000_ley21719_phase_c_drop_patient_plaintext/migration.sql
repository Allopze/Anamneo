-- =====================================================================
-- Ley 21.719 Art 14 quinquies — Phase C
--
-- Drop de columnas plaintext del Patient. Esta migracion **NO debe**
-- correrse hasta haber verificado que:
--
--   1. Todos los pacientes existentes tienen `*_enc` poblados (ejecutar
--      `backend/scripts/backfill-patient-identifier-encryption.js` en
--      cada entorno y verificar:
--        SELECT COUNT(*) FROM patients
--         WHERE (rut IS NOT NULL AND rut_enc IS NULL)
--            OR (nombre IS NOT NULL AND nombre_enc IS NULL)
--            OR ...
--        debe retornar 0.
--   2. Todo write path popula `*_enc` automaticamente (Phase A,
--      verificada en `patients.service.ts:enrichEncryptedIdentifiers`).
--   3. Todo read path usa `decryptOrFallback` (Phase B, verificada en
--      `patients-presenters.ts`).
--   4. Tests E2E cubren: crear/buscar paciente por RUT, listar,
--      exportar regulatorio.
--   5. Backup completo de la DB tomado JUSTO antes.
--
-- Ubicacion: `prisma/migrations-pending/`. Para activarla, mover el
-- directorio a `prisma/migrations/` y correr `prisma migrate deploy`.
--
-- IMPORTANTE: esta migracion **borra los originales** y deja solo
-- `*_enc`. Si la clave de cifrado se pierde despues, los datos
-- identificatorios son irrecuperables. Asegurar backup de
-- `ENCRYPTION_KEY` en bóveda separada antes de aplicar.
-- =====================================================================

-- DropIndex
DROP INDEX IF EXISTS "patients_rut_key";

-- AlterTable
ALTER TABLE "patients" DROP COLUMN IF EXISTS "rut";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "nombre";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "telefono";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "email";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "domicilio";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "contacto_emergencia_nombre";
ALTER TABLE "patients" DROP COLUMN IF EXISTS "contacto_emergencia_telefono";

-- Despues de esta migracion el schema.prisma de Patient debe quedar:
--
--   model Patient {
--     id              String    @id @default(uuid())
--     createdById     String    @map("created_by_id")
--     rutEnc          String?   @map("rut_enc")
--     rutLookupHash   String?   @unique @map("rut_lookup_hash")
--     rutExempt       Boolean   @default(false) @map("rut_exempt")
--     rutExemptReason String?   @map("rut_exempt_reason")
--     nombreEnc       String?   @map("nombre_enc")
--     fechaNacimiento DateTime? @map("fecha_nacimiento")
--     ...
--   }
--
-- Y los presenters / write helpers deben dejar de leer las columnas
-- plaintext. Sin esto, las queries fallan con "column ... does not exist".
