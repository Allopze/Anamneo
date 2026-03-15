-- Add soft-delete archival columns to patients
ALTER TABLE "patients" ADD COLUMN "archived_at" DATETIME;
ALTER TABLE "patients" ADD COLUMN "archived_by_id" TEXT;

-- Speed up active patient queries by medico
CREATE INDEX "patients_medico_id_archived_at_idx" ON "patients"("medico_id", "archived_at");
