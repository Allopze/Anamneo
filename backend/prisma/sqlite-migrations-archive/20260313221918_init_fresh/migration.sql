-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ASISTENTE',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "medico_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medico_id" TEXT NOT NULL,
    "rut" TEXT,
    "rut_exempt" BOOLEAN NOT NULL DEFAULT false,
    "rut_exempt_reason" TEXT,
    "nombre" TEXT NOT NULL,
    "edad" INTEGER NOT NULL,
    "sexo" TEXT NOT NULL,
    "trabajo" TEXT,
    "prevision" TEXT NOT NULL,
    "domicilio" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patients_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "patient_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "antecedentes_medicos" TEXT,
    "antecedentes_quirurgicos" TEXT,
    "antecedentes_ginecoobstetricos" TEXT,
    "antecedentes_familiares" TEXT,
    "habitos" TEXT,
    "medicamentos" TEXT,
    "alergias" TEXT,
    "inmunizaciones" TEXT,
    "antecedentes_sociales" TEXT,
    "antecedentes_personales" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patient_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "completed_at" DATETIME,
    "completed_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "encounters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "encounter_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_sections_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "condition_catalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "condition_catalog_local" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medico_id" TEXT NOT NULL,
    "base_condition_id" TEXT,
    "name" TEXT NOT NULL,
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "condition_catalog_local_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "condition_catalog_local_base_condition_id_fkey" FOREIGN KEY ("base_condition_id") REFERENCES "condition_catalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "condition_suggestion_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "input_text" TEXT NOT NULL,
    "top_suggestions" TEXT NOT NULL,
    "chosen_condition_id" TEXT,
    "chosen_mode" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "condition_suggestion_logs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "text_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medico_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "section_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "text_templates_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_rut_key" ON "patients"("rut");

-- CreateIndex
CREATE INDEX "patients_medico_id_idx" ON "patients"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_histories_patient_id_key" ON "patient_histories"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_sections_encounter_id_section_key_key" ON "encounter_sections"("encounter_id", "section_key");

-- CreateIndex
CREATE INDEX "condition_catalog_local_medico_id_idx" ON "condition_catalog_local"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_catalog_local_medico_id_base_condition_id_key" ON "condition_catalog_local"("medico_id", "base_condition_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "text_templates_medico_id_idx" ON "text_templates"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

