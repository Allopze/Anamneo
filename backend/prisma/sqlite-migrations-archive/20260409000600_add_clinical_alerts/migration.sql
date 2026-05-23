-- CreateTable
CREATE TABLE "clinical_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auto_generated" BOOLEAN NOT NULL DEFAULT 0,
    "acknowledged_at" DATETIME,
    "acknowledged_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clinical_alerts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_idx" ON "clinical_alerts" ("patient_id", "acknowledged_at");
