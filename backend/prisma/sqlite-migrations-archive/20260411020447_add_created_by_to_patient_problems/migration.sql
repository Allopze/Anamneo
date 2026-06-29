-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_patient_problems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT,
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
    CONSTRAINT "patient_problems_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_patient_problems" ("created_at", "encounter_id", "id", "label", "notes", "onset_date", "patient_id", "resolved_at", "severity", "status", "updated_at") SELECT "created_at", "encounter_id", "id", "label", "notes", "onset_date", "patient_id", "resolved_at", "severity", "status", "updated_at" FROM "patient_problems";
DROP TABLE "patient_problems";
ALTER TABLE "new_patient_problems" RENAME TO "patient_problems";
CREATE INDEX "patient_problems_patient_id_status_idx" ON "patient_problems"("patient_id", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
