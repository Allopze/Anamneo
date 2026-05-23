/*
  Warnings:

  - You are about to drop the `informed_consents` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "informed_consents" DROP CONSTRAINT "informed_consents_encounter_id_fkey";

-- DropForeignKey
ALTER TABLE "informed_consents" DROP CONSTRAINT "informed_consents_granted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "informed_consents" DROP CONSTRAINT "informed_consents_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "informed_consents" DROP CONSTRAINT "informed_consents_revoked_by_id_fkey";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "encryption_envelope" JSONB;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_by_id" TEXT,
ADD COLUMN     "blocked_reason" TEXT,
ADD COLUMN     "legal_representative_contact" TEXT,
ADD COLUMN     "legal_representative_name" TEXT,
ADD COLUMN     "legal_representative_relationship" TEXT,
ADD COLUMN     "legal_representative_rut" TEXT,
ADD COLUMN     "processing_objections" JSONB;

-- DropTable
DROP TABLE "informed_consents";

-- CreateTable
CREATE TABLE "clinical_consents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRATAMIENTO',
    "description" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_data_processing_consents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "legal_document_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "method" TEXT NOT NULL,
    "captured_ip" TEXT,
    "captured_user_agent" TEXT,
    "captured_by_user_id" TEXT,
    "signer_name" TEXT NOT NULL,
    "signer_rut" TEXT,
    "signer_relationship" TEXT NOT NULL,
    "evidence_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_data_processing_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_data_requests" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requester_name" TEXT NOT NULL,
    "requester_rut" TEXT,
    "requester_email" TEXT NOT NULL,
    "identity_verification_method" TEXT,
    "identity_verification_evidence" JSONB,
    "due_date" TIMESTAMP(3) NOT NULL,
    "prorroga_due_date" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_note" TEXT,
    "payload_request" TEXT NOT NULL,
    "payload_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_breach_incidents" (
    "id" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "affected_patient_ids" JSONB,
    "root_cause" TEXT,
    "containment_actions" TEXT,
    "risk_assessment" TEXT,
    "reported_to_agency_at" TIMESTAMP(3),
    "reported_to_subjects_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_consents_patient_id_revoked_at_idx" ON "clinical_consents"("patient_id", "revoked_at");

-- CreateIndex
CREATE INDEX "clinical_consents_patient_id_revoked_at_granted_at_idx" ON "clinical_consents"("patient_id", "revoked_at", "granted_at");

-- CreateIndex
CREATE INDEX "patient_data_processing_consents_patient_id_purpose_revoked_idx" ON "patient_data_processing_consents"("patient_id", "purpose", "revoked_at");

-- CreateIndex
CREATE INDEX "patient_data_processing_consents_legal_document_id_idx" ON "patient_data_processing_consents"("legal_document_id");

-- CreateIndex
CREATE INDEX "patient_data_requests_status_due_date_idx" ON "patient_data_requests"("status", "due_date");

-- CreateIndex
CREATE INDEX "patient_data_requests_patient_id_request_type_idx" ON "patient_data_requests"("patient_id", "request_type");

-- CreateIndex
CREATE INDEX "patient_data_requests_requester_rut_idx" ON "patient_data_requests"("requester_rut");

-- CreateIndex
CREATE INDEX "data_breach_incidents_severity_status_idx" ON "data_breach_incidents"("severity", "status");

-- CreateIndex
CREATE INDEX "data_breach_incidents_detected_at_idx" ON "data_breach_incidents"("detected_at");

-- CreateIndex
CREATE INDEX "patients_blocked_at_idx" ON "patients"("blocked_at");

-- AddForeignKey
ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_data_processing_consents" ADD CONSTRAINT "patient_data_processing_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_data_processing_consents" ADD CONSTRAINT "patient_data_processing_consents_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_data_processing_consents" ADD CONSTRAINT "patient_data_processing_consents_captured_by_user_id_fkey" FOREIGN KEY ("captured_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_data_requests" ADD CONSTRAINT "patient_data_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_data_requests" ADD CONSTRAINT "patient_data_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
