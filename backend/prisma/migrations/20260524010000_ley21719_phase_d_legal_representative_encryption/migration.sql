-- =====================================================================
-- Ley 21.719 Art 16 quater — Phase D
--
-- Agrega columnas cifradas para los datos del representante legal NNA:
-- `legal_representative_name_enc`, `legal_representative_rut_enc`,
-- `legal_representative_rut_lookup_hash`, `legal_representative_relationship_enc`,
-- `legal_representative_contact_enc`.
--
-- Las columnas plaintext originales se mantienen temporalmente para
-- permitir el backfill (script: backfill-legal-representative-encryption.js).
-- El drop de plaintext se ejecutará DESPUÉS del backfill como Phase D-drop
-- (ver migrations-pending/20260524010000_ley21719_phase_d_drop_legal_representative_plaintext).
-- =====================================================================

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "legal_representative_name_enc"         TEXT,
  ADD COLUMN IF NOT EXISTS "legal_representative_rut_enc"          TEXT,
  ADD COLUMN IF NOT EXISTS "legal_representative_rut_lookup_hash"  TEXT,
  ADD COLUMN IF NOT EXISTS "legal_representative_relationship_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "legal_representative_contact_enc"      TEXT;
