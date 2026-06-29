-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audit_chain_state" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "latest_hash" TEXT NOT NULL DEFAULT 'GENESIS',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_audit_chain_state" ("id", "latest_hash", "sequence", "updated_at") SELECT "id", "latest_hash", "sequence", "updated_at" FROM "audit_chain_state";
DROP TABLE "audit_chain_state";
ALTER TABLE "new_audit_chain_state" RENAME TO "audit_chain_state";
CREATE TABLE "new_audit_integrity_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'latest',
    "valid" BOOLEAN NOT NULL,
    "checked" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "broken_at" TEXT,
    "warning" TEXT,
    "verification_scope" TEXT NOT NULL,
    "verified_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_audit_integrity_snapshots" ("broken_at", "checked", "id", "total", "valid", "verification_scope", "verified_at", "warning") SELECT "broken_at", "checked", "id", "total", "valid", "verification_scope", "verified_at", "warning" FROM "audit_integrity_snapshots";
DROP TABLE "audit_integrity_snapshots";
ALTER TABLE "new_audit_integrity_snapshots" RENAME TO "audit_integrity_snapshots";
CREATE TABLE "new_clinical_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" DATETIME,
    "acknowledged_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clinical_alerts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clinical_alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clinical_alerts_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clinical_alerts" ("acknowledged_at", "acknowledged_by_id", "auto_generated", "created_at", "created_by_id", "encounter_id", "id", "message", "patient_id", "severity", "title", "type") SELECT "acknowledged_at", "acknowledged_by_id", "auto_generated", "created_at", "created_by_id", "encounter_id", "id", "message", "patient_id", "severity", "title", "type" FROM "clinical_alerts";
DROP TABLE "clinical_alerts";
ALTER TABLE "new_clinical_alerts" RENAME TO "clinical_alerts";
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_idx" ON "clinical_alerts"("patient_id", "acknowledged_at");
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_created_at_idx" ON "clinical_alerts"("patient_id", "acknowledged_at", "created_at");
CREATE INDEX "clinical_alerts_encounter_id_acknowledged_at_idx" ON "clinical_alerts"("encounter_id", "acknowledged_at");
CREATE TABLE "new_informed_consents" (
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
    CONSTRAINT "informed_consents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "informed_consents_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "informed_consents_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_informed_consents" ("created_at", "description", "encounter_id", "granted_at", "granted_by_id", "id", "patient_id", "revoked_at", "revoked_by_id", "revoked_reason", "type", "updated_at") SELECT "created_at", "description", "encounter_id", "granted_at", "granted_by_id", "id", "patient_id", "revoked_at", "revoked_by_id", "revoked_reason", "type", "updated_at" FROM "informed_consents";
DROP TABLE "informed_consents";
ALTER TABLE "new_informed_consents" RENAME TO "informed_consents";
CREATE INDEX "informed_consents_patient_id_revoked_at_idx" ON "informed_consents"("patient_id", "revoked_at");
CREATE INDEX "informed_consents_patient_id_revoked_at_granted_at_idx" ON "informed_consents"("patient_id", "revoked_at", "granted_at");
CREATE TABLE "new_legal_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "effective_at" DATETIME NOT NULL,
    "published_at" DATETIME,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_legal_documents" ("content_json", "created_at", "created_by_id", "description", "effective_at", "id", "published_at", "status", "title", "type", "updated_at", "updated_by_id", "version") SELECT "content_json", "created_at", "created_by_id", "description", "effective_at", "id", "published_at", "status", "title", "type", "updated_at", "updated_by_id", "version" FROM "legal_documents";
DROP TABLE "legal_documents";
ALTER TABLE "new_legal_documents" RENAME TO "legal_documents";
CREATE INDEX "legal_documents_type_status_idx" ON "legal_documents"("type", "status");
CREATE INDEX "legal_documents_status_published_at_idx" ON "legal_documents"("status", "published_at");
CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "legal_documents"("type", "version");
CREATE TABLE "new_patient_clinical_search" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patient_clinical_search_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_patient_clinical_search" ("id", "medico_id", "patient_id", "text", "updated_at") SELECT "id", "medico_id", "patient_id", "text", "updated_at" FROM "patient_clinical_search";
DROP TABLE "patient_clinical_search";
ALTER TABLE "new_patient_clinical_search" RENAME TO "patient_clinical_search";
CREATE INDEX "patient_clinical_search_medico_id_idx" ON "patient_clinical_search"("medico_id");
CREATE INDEX "patient_clinical_search_patient_id_idx" ON "patient_clinical_search"("patient_id");
CREATE UNIQUE INDEX "patient_clinical_search_patient_id_medico_id_key" ON "patient_clinical_search"("patient_id", "medico_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
