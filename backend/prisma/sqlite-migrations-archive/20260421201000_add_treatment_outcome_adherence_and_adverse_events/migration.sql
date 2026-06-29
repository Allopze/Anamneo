CREATE TABLE "encounter_treatments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "diagnosis_id" TEXT,
    "treatment_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "details" TEXT,
    "dose" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "indication" TEXT,
    "status" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_treatments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "encounter_treatments_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "encounter_diagnoses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "encounter_treatments_encounter_id_idx" ON "encounter_treatments"("encounter_id");
CREATE INDEX "encounter_treatments_diagnosis_id_idx" ON "encounter_treatments"("diagnosis_id");
CREATE INDEX "encounter_treatments_normalized_label_idx" ON "encounter_treatments"("normalized_label");

CREATE TABLE "encounter_treatment_outcomes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_treatment_id" TEXT NOT NULL,
    "outcome_status" TEXT NOT NULL,
    "outcome_source" TEXT NOT NULL,
    "adherence_status" TEXT,
    "adverse_event_severity" TEXT,
    "adverse_event_notes" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_treatment_outcomes_encounter_treatment_id_fkey" FOREIGN KEY ("encounter_treatment_id") REFERENCES "encounter_treatments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "encounter_treatment_outcomes_encounter_treatment_id_idx" ON "encounter_treatment_outcomes"("encounter_treatment_id");
