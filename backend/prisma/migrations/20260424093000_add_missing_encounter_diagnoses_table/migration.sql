CREATE TABLE IF NOT EXISTS "encounter_diagnoses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "encounter_diagnoses_encounter_id_idx" ON "encounter_diagnoses"("encounter_id");
CREATE INDEX IF NOT EXISTS "encounter_diagnoses_normalized_label_idx" ON "encounter_diagnoses"("normalized_label");
