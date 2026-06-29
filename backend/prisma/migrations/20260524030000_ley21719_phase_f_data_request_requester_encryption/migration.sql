-- =====================================================================
-- Ley 21.719 Art 14 quinquies — Phase F
--
-- Agrega columnas cifradas para los datos del solicitante DSAR:
-- `requester_name_enc`, `requester_rut_enc`, `requester_rut_lookup_hash`,
-- `requester_email_enc`.
--
-- Las columnas plaintext se mantienen para backfill.
-- El drop está en migrations-pending/20260524030000_ley21719_phase_f_drop_*.
-- =====================================================================

ALTER TABLE "patient_data_requests"
  ADD COLUMN IF NOT EXISTS "requester_name_enc"       TEXT,
  ADD COLUMN IF NOT EXISTS "requester_rut_enc"        TEXT,
  ADD COLUMN IF NOT EXISTS "requester_rut_lookup_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "requester_email_enc"      TEXT;
