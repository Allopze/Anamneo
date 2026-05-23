-- AlterTable
ALTER TABLE "encounters" ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'NO_REQUIERE_REVISION';
ALTER TABLE "encounters" ADD COLUMN "review_requested_at" DATETIME;
ALTER TABLE "encounters" ADD COLUMN "reviewed_at" DATETIME;
ALTER TABLE "encounters" ADD COLUMN "reviewed_by_id" TEXT;

-- CreateTable
CREATE TABLE "patient_problems" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "severity" TEXT,
    "onset_date" DATETIME,
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patient_problems_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "patient_problems_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "encounter_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT NOT NULL,
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
    CONSTRAINT "encounter_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "patient_problems_patient_id_status_idx" ON "patient_problems"("patient_id", "status");

-- CreateIndex
CREATE INDEX "encounter_tasks_patient_id_status_due_date_idx" ON "encounter_tasks"("patient_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "encounter_tasks_encounter_id_idx" ON "encounter_tasks"("encounter_id");
