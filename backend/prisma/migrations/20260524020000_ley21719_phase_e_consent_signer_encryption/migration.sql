-- =====================================================================
-- Ley 21.719 Art 14 quinquies — Phase E
--
-- Agrega columnas cifradas para la identidad del firmante del consentimiento:
-- `signer_name_enc`, `signer_rut_enc`, `signer_rut_lookup_hash`.
--
-- Las columnas plaintext se mantienen temporalmente para el backfill.
-- El drop está en migrations-pending/20260524020000_ley21719_phase_e_drop_consent_signer_plaintext.
-- =====================================================================

ALTER TABLE "patient_data_processing_consents"
  ADD COLUMN IF NOT EXISTS "signer_name_enc"       TEXT,
  ADD COLUMN IF NOT EXISTS "signer_rut_enc"        TEXT,
  ADD COLUMN IF NOT EXISTS "signer_rut_lookup_hash" TEXT;
