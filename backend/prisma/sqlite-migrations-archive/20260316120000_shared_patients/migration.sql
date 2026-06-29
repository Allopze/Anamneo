-- Migration: shared_patients
-- Patients are no longer owned by a single doctor.
-- Encounters now have their own medicoId for access control.

-- Step 1: Add created_by_id to patients (copy from medico_id)
ALTER TABLE "patients" ADD COLUMN "created_by_id" TEXT;
UPDATE "patients" SET "created_by_id" = "medico_id";

-- Step 2: Add medico_id to encounters (copy from patient's medico_id)
ALTER TABLE "encounters" ADD COLUMN "medico_id" TEXT;
UPDATE "encounters" SET "medico_id" = (
  SELECT "medico_id" FROM "patients" WHERE "patients"."id" = "encounters"."patient_id"
);

-- Step 3: Make new columns NOT NULL after data is populated
-- SQLite doesn't support ALTER COLUMN, so we recreate tables

-- Recreate patients table without medico_id, with created_by_id NOT NULL
CREATE TABLE "patients_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by_id" TEXT NOT NULL,
    "rut" TEXT,
    "rut_exempt" BOOLEAN NOT NULL DEFAULT false,
    "rut_exempt_reason" TEXT,
    "nombre" TEXT NOT NULL,
    "edad" INTEGER NOT NULL,
    "sexo" TEXT NOT NULL,
    "trabajo" TEXT,
    "prevision" TEXT NOT NULL,
    "domicilio" TEXT,
    "archived_at" DATETIME,
    "archived_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "patients_new" SELECT
    "id", "created_by_id", "rut", "rut_exempt", "rut_exempt_reason",
    "nombre", "edad", "sexo", "trabajo", "prevision", "domicilio",
    "archived_at", "archived_by_id", "created_at", "updated_at"
FROM "patients";

DROP TABLE "patients";
ALTER TABLE "patients_new" RENAME TO "patients";

-- Recreate encounters table with medico_id NOT NULL
CREATE TABLE "encounters_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "review_status" TEXT NOT NULL DEFAULT 'NO_REQUIERE_REVISION',
    "review_requested_at" DATETIME,
    "reviewed_at" DATETIME,
    "reviewed_by_id" TEXT,
    "completed_at" DATETIME,
    "completed_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "encounters_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "encounters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "encounters_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "encounters_new" SELECT
    "id", "patient_id", "medico_id", "created_by_id", "status", "review_status",
    "review_requested_at", "reviewed_at", "reviewed_by_id",
    "completed_at", "completed_by_id", "created_at", "updated_at"
FROM "encounters";

DROP TABLE "encounters";
ALTER TABLE "encounters_new" RENAME TO "encounters";

-- Step 4: Create new indexes
CREATE INDEX "patients_archived_at_idx" ON "patients"("archived_at");
CREATE UNIQUE INDEX "patients_rut_key" ON "patients"("rut");
CREATE INDEX "encounters_medico_id_idx" ON "encounters"("medico_id");
