DROP INDEX "patients_rut_key";

CREATE UNIQUE INDEX "patients_medico_id_rut_key" ON "patients"("medico_id", "rut");
