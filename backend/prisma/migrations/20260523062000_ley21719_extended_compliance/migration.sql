-- AlterTable
ALTER TABLE "patient_data_processing_consents" ADD COLUMN     "clinic_id" TEXT,
ADD COLUMN     "consent_payload_snapshot" JSONB,
ADD COLUMN     "language" TEXT DEFAULT 'es-CL',
ADD COLUMN     "representative_bond_evidence_ref" TEXT,
ADD COLUMN     "revoked_channel" TEXT,
ADD COLUMN     "revoked_reason" TEXT,
ADD COLUMN     "session_id" TEXT;
