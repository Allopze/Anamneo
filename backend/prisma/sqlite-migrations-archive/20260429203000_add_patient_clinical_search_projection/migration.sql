-- CreateTable
CREATE TABLE "patient_clinical_search" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "patient_id" TEXT NOT NULL,
  "medico_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_clinical_search_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_clinical_search_patient_id_medico_id_key" ON "patient_clinical_search"("patient_id", "medico_id");

-- CreateIndex
CREATE INDEX "patient_clinical_search_medico_id_idx" ON "patient_clinical_search"("medico_id");

-- CreateIndex
CREATE INDEX "patient_clinical_search_patient_id_idx" ON "patient_clinical_search"("patient_id");

-- BackfillProjection
INSERT INTO "patient_clinical_search" ("id", "patient_id", "medico_id", "text", "updated_at")
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS "id",
  "encounters"."patient_id",
  "encounters"."medico_id",
  lower(group_concat("encounter_sections"."data", char(10))) AS "text",
  CURRENT_TIMESTAMP AS "updated_at"
FROM "encounter_sections"
JOIN "encounters" ON "encounters"."id" = "encounter_sections"."encounter_id"
WHERE "encounter_sections"."section_key" IN ('MOTIVO_CONSULTA', 'ANAMNESIS_PROXIMA', 'REVISION_SISTEMAS')
GROUP BY "encounters"."patient_id", "encounters"."medico_id"
HAVING length(trim("text")) > 0;
