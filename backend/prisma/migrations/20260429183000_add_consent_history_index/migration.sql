-- CreateIndex
CREATE INDEX "informed_consents_patient_id_revoked_at_granted_at_idx" ON "informed_consents"("patient_id", "revoked_at", "granted_at");
