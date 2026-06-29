-- =====================================================================
-- Ley 21.719 Art 14 quinquies — Phase F-drop
--
-- Drop de columnas plaintext del solicitante DSAR en patient_data_requests.
-- Esta migración NO debe correrse hasta verificar:
--
--   SELECT COUNT(*) FROM patient_data_requests
--    WHERE requester_name_enc IS NULL
--       OR requester_email_enc IS NULL;
--   Debe retornar 0.
--
-- Para activar: mover a `prisma/migrations/` y correr `prisma migrate deploy`.
-- =====================================================================

ALTER TABLE "patient_data_requests"
  DROP COLUMN IF EXISTS "requester_name",
  DROP COLUMN IF EXISTS "requester_rut",
  DROP COLUMN IF EXISTS "requester_email";

-- El índice @@index([requesterRut]) debe ser reemplazado por @@index([requesterRutLookupHash])
-- en schema.prisma antes de aplicar esta migración, y los índices SQL actualizados también:
DROP INDEX IF EXISTS "patient_data_requests_requester_rut_idx";
CREATE INDEX IF NOT EXISTS "patient_data_requests_requester_rut_lookup_hash_idx"
  ON "patient_data_requests" ("requester_rut_lookup_hash");
