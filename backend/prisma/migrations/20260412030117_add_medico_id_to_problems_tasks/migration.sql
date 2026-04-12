-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_encounter_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "medico_id" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SEGUIMIENTO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "due_date" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "encounter_tasks_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "encounter_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "encounter_tasks_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_encounter_tasks" ("completed_at", "created_at", "created_by_id", "details", "due_date", "encounter_id", "id", "patient_id", "priority", "status", "title", "type", "updated_at") SELECT "completed_at", "created_at", "created_by_id", "details", "due_date", "encounter_id", "id", "patient_id", "priority", "status", "title", "type", "updated_at" FROM "encounter_tasks";
DROP TABLE "encounter_tasks";
ALTER TABLE "new_encounter_tasks" RENAME TO "encounter_tasks";
CREATE INDEX "encounter_tasks_patient_id_status_due_date_idx" ON "encounter_tasks"("patient_id", "status", "due_date");
CREATE INDEX "encounter_tasks_encounter_id_idx" ON "encounter_tasks"("encounter_id");
CREATE INDEX "encounter_tasks_medico_id_idx" ON "encounter_tasks"("medico_id");
CREATE TABLE "new_patient_problems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT,
    "medico_id" TEXT,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "severity" TEXT,
    "onset_date" DATETIME,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patient_problems_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "patient_problems_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "patient_problems_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "patient_problems_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_patient_problems" ("created_at", "created_by_id", "encounter_id", "id", "label", "notes", "onset_date", "patient_id", "resolved_at", "severity", "status", "updated_at") SELECT "created_at", "created_by_id", "encounter_id", "id", "label", "notes", "onset_date", "patient_id", "resolved_at", "severity", "status", "updated_at" FROM "patient_problems";
DROP TABLE "patient_problems";
ALTER TABLE "new_patient_problems" RENAME TO "patient_problems";
CREATE INDEX "patient_problems_patient_id_status_idx" ON "patient_problems"("patient_id", "status");
CREATE INDEX "patient_problems_medico_id_idx" ON "patient_problems"("medico_id");

-- Backfill medico_id from encounters
UPDATE "encounter_tasks" SET "medico_id" = (
  SELECT e."medico_id" FROM "encounters" e WHERE e."id" = "encounter_tasks"."encounter_id"
) WHERE "encounter_id" IS NOT NULL;

UPDATE "patient_problems" SET "medico_id" = (
  SELECT e."medico_id" FROM "encounters" e WHERE e."id" = "patient_problems"."encounter_id"
) WHERE "encounter_id" IS NOT NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
