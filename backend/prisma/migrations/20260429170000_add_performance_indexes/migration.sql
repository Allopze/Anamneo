-- CreateIndex
CREATE INDEX "patients_created_by_id_archived_at_created_at_idx" ON "patients"("created_by_id", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "patients_completeness_status_archived_at_idx" ON "patients"("completeness_status", "archived_at");

-- CreateIndex
CREATE INDEX "patients_updated_at_idx" ON "patients"("updated_at");

-- CreateIndex
CREATE INDEX "encounters_medico_id_status_created_at_idx" ON "encounters"("medico_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "encounters_medico_id_review_status_created_at_idx" ON "encounters"("medico_id", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "encounters_patient_id_medico_id_created_at_idx" ON "encounters"("patient_id", "medico_id", "created_at");

-- CreateIndex
CREATE INDEX "encounters_updated_at_idx" ON "encounters"("updated_at");

-- CreateIndex
CREATE INDEX "encounter_tasks_medico_id_status_due_date_idx" ON "encounter_tasks"("medico_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_created_at_idx" ON "clinical_alerts"("patient_id", "acknowledged_at", "created_at");

-- CreateIndex
CREATE INDEX "clinical_alerts_encounter_id_acknowledged_at_idx" ON "clinical_alerts"("encounter_id", "acknowledged_at");
