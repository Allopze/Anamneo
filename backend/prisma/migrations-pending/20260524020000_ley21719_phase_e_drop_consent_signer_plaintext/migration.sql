-- =====================================================================
-- Ley 21.719 Art 14 quinquies — Phase E-drop
--
-- Drop de columnas plaintext del firmante en patient_data_processing_consents.
-- Esta migración NO debe correrse hasta verificar:
--
--   SELECT COUNT(*) FROM patient_data_processing_consents
--    WHERE signer_name_enc IS NULL;
--   Debe retornar 0.
--
-- Para activar: mover a `prisma/migrations/` y correr `prisma migrate deploy`.
-- =====================================================================

ALTER TABLE "patient_data_processing_consents"
  DROP COLUMN IF EXISTS "signer_name",
  DROP COLUMN IF EXISTS "signer_rut";
