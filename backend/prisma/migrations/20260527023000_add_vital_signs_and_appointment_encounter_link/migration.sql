ALTER TABLE "encounters"
ADD COLUMN "appointment_id" TEXT;

ALTER TABLE "condition_catalog"
ADD COLUMN "cie_code" TEXT;

CREATE TABLE "encounter_vital_signs" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature_celsius" DECIMAL(4,1),
    "oxygen_saturation" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,2),
    "bmi" DECIMAL(4,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_vital_signs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "encounters_appointment_id_key" ON "encounters"("appointment_id");
CREATE INDEX "encounters_appointment_id_idx" ON "encounters"("appointment_id");
CREATE INDEX "condition_catalog_cie_code_idx" ON "condition_catalog"("cie_code");
CREATE UNIQUE INDEX "encounter_vital_signs_encounter_id_key" ON "encounter_vital_signs"("encounter_id");
CREATE INDEX "encounter_vital_signs_patient_id_measured_at_idx" ON "encounter_vital_signs"("patient_id", "measured_at");

ALTER TABLE "encounters"
ADD CONSTRAINT "encounters_appointment_id_fkey"
FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "encounter_vital_signs"
ADD CONSTRAINT "encounter_vital_signs_encounter_id_fkey"
FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "encounter_vital_signs"
ADD CONSTRAINT "encounter_vital_signs_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
