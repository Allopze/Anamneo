CREATE TABLE "encounter_episodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "first_encounter_id" TEXT,
    "last_encounter_id" TEXT,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_episodes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "encounters" ADD COLUMN "episode_id" TEXT;

CREATE INDEX "encounter_episodes_patient_id_idx" ON "encounter_episodes"("patient_id");
CREATE INDEX "encounter_episodes_normalized_label_idx" ON "encounter_episodes"("normalized_label");
