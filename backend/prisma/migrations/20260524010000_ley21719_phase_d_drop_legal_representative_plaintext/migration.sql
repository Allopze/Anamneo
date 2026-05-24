-- =====================================================================
-- Ley 21.719 Art 16 quater — Phase D-drop
--
-- Drop de columnas plaintext del representante legal NNA.
-- Esta migración NO debe correrse hasta haber verificado que:
--
--   1. Todos los pacientes con representante legal tienen `*_enc` poblados:
--      SELECT COUNT(*) FROM patients
--       WHERE (legal_representative_name IS NOT NULL AND legal_representative_name_enc IS NULL)
--          OR (legal_representative_rut IS NOT NULL AND legal_representative_rut_enc IS NULL)
--          OR (legal_representative_relationship IS NOT NULL AND legal_representative_relationship_enc IS NULL)
--          OR (legal_representative_contact IS NOT NULL AND legal_representative_contact_enc IS NULL);
--      Debe retornar 0.
--
--   2. Todo write path popula `*_enc` automáticamente
--      (verificado en patients.service.ts + buildEncryptedPatientIdentifierFields).
--
--   3. Todo read path usa resolvePatientIdentifiers con fallback al enc
--      (verificado en patients-presenters.ts, patient-portal.service.ts).
--
--   4. Backup completo de la DB tomado JUSTO antes.
--
-- Para activar: mover este directorio a `prisma/migrations/` y correr
-- `prisma migrate deploy`.
-- =====================================================================

ALTER TABLE "patients"
  DROP COLUMN IF EXISTS "legal_representative_name",
  DROP COLUMN IF EXISTS "legal_representative_rut",
  DROP COLUMN IF EXISTS "legal_representative_relationship",
  DROP COLUMN IF EXISTS "legal_representative_contact";
