-- CreateTable
CREATE TABLE "informed_consents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRATAMIENTO',
    "description" TEXT NOT NULL,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_id" TEXT NOT NULL,
    "revoked_at" DATETIME,
    "revoked_by_id" TEXT,
    "revoked_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "informed_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "informed_consents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "informed_consents_patient_id_revoked_at_idx" ON "informed_consents" ("patient_id", "revoked_at");
