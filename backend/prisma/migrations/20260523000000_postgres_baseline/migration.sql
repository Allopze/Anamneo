CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ASISTENTE',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "medico_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_recovery_codes" TEXT,
    "refresh_token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "rut" TEXT,
    "rut_exempt" BOOLEAN NOT NULL DEFAULT false,
    "rut_exempt_reason" TEXT,
    "nombre" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3),
    "edad" INTEGER,
    "edad_meses" INTEGER,
    "sexo" TEXT,
    "trabajo" TEXT,
    "prevision" TEXT,
    "registration_mode" TEXT NOT NULL DEFAULT 'COMPLETO',
    "completeness_status" TEXT NOT NULL DEFAULT 'VERIFICADA',
    "demographics_verified_at" TIMESTAMP(3),
    "demographics_verified_by_id" TEXT,
    "domicilio" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "contacto_emergencia_nombre" TEXT,
    "contacto_emergencia_telefono" TEXT,
    "centro_medico" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_clinical_search" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_clinical_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_histories" (
    "id" TEXT NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "review_status" TEXT NOT NULL DEFAULT 'NO_REQUIERE_REVISION',
    "review_requested_at" TIMESTAMP(3),
    "review_requested_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "episode_id" TEXT,
    "closure_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_episodes" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "first_encounter_id" TEXT,
    "last_encounter_id" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_signatures" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature_type" TEXT NOT NULL DEFAULT 'FES',
    "content_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "encounter_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_sections" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_diagnoses" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_treatments" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "diagnosis_id" TEXT,
    "treatment_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL DEFAULT '',
    "details" TEXT,
    "dose" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "indication" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_treatment_outcomes" (
    "id" TEXT NOT NULL,
    "encounter_treatment_id" TEXT NOT NULL,
    "outcome_status" TEXT NOT NULL,
    "outcome_source" TEXT NOT NULL,
    "adherence_status" TEXT,
    "adverse_event_severity" TEXT,
    "adverse_event_notes" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_treatment_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL DEFAULT '',
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condition_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_catalog_local" (
    "id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "base_condition_id" TEXT,
    "name" TEXT NOT NULL,
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condition_catalog_local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL DEFAULT '',
    "active_ingredient" TEXT NOT NULL,
    "default_dose" TEXT,
    "default_route" TEXT,
    "default_frequency" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_suggestion_logs" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "input_text" TEXT NOT NULL,
    "persisted_text_snapshot" TEXT,
    "top_suggestions" TEXT NOT NULL,
    "ranking_version" TEXT NOT NULL DEFAULT '2026-04-name-synonyms-tags-v1',
    "ranking_metadata" TEXT NOT NULL DEFAULT '{}',
    "chosen_condition_id" TEXT,
    "chosen_mode" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_suggestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_id" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "diff" TEXT,
    "integrity_hash" TEXT,
    "previous_hash" TEXT,
    "chain_sequence" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_chain_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "latest_hash" TEXT NOT NULL DEFAULT 'GENESIS',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_chain_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_integrity_snapshots" (
    "id" TEXT NOT NULL DEFAULT 'latest',
    "valid" BOOLEAN NOT NULL,
    "checked" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "broken_at" TEXT,
    "warning" TEXT,
    "verification_scope" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_integrity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "linked_order_type" TEXT,
    "linked_order_id" TEXT,
    "linked_order_label" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,
    "scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "scan_result" TEXT,
    "scanned_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_problems" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT,
    "medico_id" TEXT,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "severity" TEXT,
    "onset_date" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_tasks" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "medico_id" TEXT,
    "recurrence_source_task_id" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SEGUIMIENTO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "recurrence_rule" TEXT NOT NULL DEFAULT 'NONE',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_legal_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "user_legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "email" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "medico_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_templates" (
    "id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "section_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informed_consents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRATAMIENTO',
    "description" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "informed_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_alerts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_used_at_idx" ON "password_reset_tokens"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "patients_rut_key" ON "patients"("rut");

-- CreateIndex
CREATE INDEX "patients_archived_at_idx" ON "patients"("archived_at");

-- CreateIndex
CREATE INDEX "patients_created_by_id_archived_at_created_at_idx" ON "patients"("created_by_id", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "patients_completeness_status_archived_at_idx" ON "patients"("completeness_status", "archived_at");

-- CreateIndex
CREATE INDEX "patients_updated_at_idx" ON "patients"("updated_at");

-- CreateIndex
CREATE INDEX "patient_clinical_search_medico_id_idx" ON "patient_clinical_search"("medico_id");

-- CreateIndex
CREATE INDEX "patient_clinical_search_patient_id_idx" ON "patient_clinical_search"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_clinical_search_patient_id_medico_id_key" ON "patient_clinical_search"("patient_id", "medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_histories_patient_id_key" ON "patient_histories"("patient_id");

-- CreateIndex
CREATE INDEX "encounters_medico_id_idx" ON "encounters"("medico_id");

-- CreateIndex
CREATE INDEX "encounters_medico_id_status_created_at_idx" ON "encounters"("medico_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "encounters_medico_id_review_status_created_at_idx" ON "encounters"("medico_id", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "encounters_patient_id_medico_id_created_at_idx" ON "encounters"("patient_id", "medico_id", "created_at");

-- CreateIndex
CREATE INDEX "encounters_updated_at_idx" ON "encounters"("updated_at");

-- CreateIndex
CREATE INDEX "encounter_episodes_patient_id_idx" ON "encounter_episodes"("patient_id");

-- CreateIndex
CREATE INDEX "encounter_episodes_normalized_label_idx" ON "encounter_episodes"("normalized_label");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_sections_encounter_id_section_key_key" ON "encounter_sections"("encounter_id", "section_key");

-- CreateIndex
CREATE INDEX "encounter_diagnoses_encounter_id_idx" ON "encounter_diagnoses"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_diagnoses_normalized_label_idx" ON "encounter_diagnoses"("normalized_label");

-- CreateIndex
CREATE INDEX "encounter_treatments_encounter_id_idx" ON "encounter_treatments"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_treatments_diagnosis_id_idx" ON "encounter_treatments"("diagnosis_id");

-- CreateIndex
CREATE INDEX "encounter_treatments_normalized_label_idx" ON "encounter_treatments"("normalized_label");

-- CreateIndex
CREATE INDEX "encounter_treatment_outcomes_encounter_treatment_id_idx" ON "encounter_treatment_outcomes"("encounter_treatment_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_catalog_normalized_name_key" ON "condition_catalog"("normalized_name");

-- CreateIndex
CREATE INDEX "condition_catalog_local_medico_id_idx" ON "condition_catalog_local"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_catalog_local_medico_id_base_condition_id_key" ON "condition_catalog_local"("medico_id", "base_condition_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_normalized_name_key" ON "medication_catalog"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_chain_sequence_key" ON "audit_logs"("chain_sequence");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_reason_idx" ON "audit_logs"("reason");

-- CreateIndex
CREATE INDEX "audit_logs_result_idx" ON "audit_logs"("result");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "attachments_encounter_id_linked_order_type_linked_order_id_idx" ON "attachments"("encounter_id", "linked_order_type", "linked_order_id");

-- CreateIndex
CREATE INDEX "attachments_deleted_at_idx" ON "attachments"("deleted_at");

-- CreateIndex
CREATE INDEX "attachments_scan_status_idx" ON "attachments"("scan_status");

-- CreateIndex
CREATE INDEX "patient_problems_patient_id_status_idx" ON "patient_problems"("patient_id", "status");

-- CreateIndex
CREATE INDEX "patient_problems_medico_id_idx" ON "patient_problems"("medico_id");

-- CreateIndex
CREATE INDEX "encounter_tasks_patient_id_status_due_date_idx" ON "encounter_tasks"("patient_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "encounter_tasks_encounter_id_idx" ON "encounter_tasks"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_tasks_medico_id_idx" ON "encounter_tasks"("medico_id");

-- CreateIndex
CREATE INDEX "encounter_tasks_medico_id_status_due_date_idx" ON "encounter_tasks"("medico_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "encounter_tasks_recurrence_source_task_id_idx" ON "encounter_tasks"("recurrence_source_task_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_legal_acceptances_user_id_document_type_idx" ON "user_legal_acceptances"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "user_legal_acceptances_accepted_at_idx" ON "user_legal_acceptances"("accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_legal_acceptances_user_id_document_type_version_key" ON "user_legal_acceptances"("user_id", "document_type", "version");

-- CreateIndex
CREATE INDEX "legal_documents_type_status_idx" ON "legal_documents"("type", "status");

-- CreateIndex
CREATE INDEX "legal_documents_status_published_at_idx" ON "legal_documents"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "legal_documents"("type", "version");

-- CreateIndex
CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "user_invitations_email_revoked_at_accepted_at_expires_at_idx" ON "user_invitations"("email", "revoked_at", "accepted_at", "expires_at");

-- CreateIndex
CREATE INDEX "text_templates_medico_id_idx" ON "text_templates"("medico_id");

-- CreateIndex
CREATE INDEX "informed_consents_patient_id_revoked_at_idx" ON "informed_consents"("patient_id", "revoked_at");

-- CreateIndex
CREATE INDEX "informed_consents_patient_id_revoked_at_granted_at_idx" ON "informed_consents"("patient_id", "revoked_at", "granted_at");

-- CreateIndex
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_idx" ON "clinical_alerts"("patient_id", "acknowledged_at");

-- CreateIndex
CREATE INDEX "clinical_alerts_patient_id_acknowledged_at_created_at_idx" ON "clinical_alerts"("patient_id", "acknowledged_at", "created_at");

-- CreateIndex
CREATE INDEX "clinical_alerts_encounter_id_acknowledged_at_idx" ON "clinical_alerts"("encounter_id", "acknowledged_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_clinical_search" ADD CONSTRAINT "patient_clinical_search_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_histories" ADD CONSTRAINT "patient_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_review_requested_by_id_fkey" FOREIGN KEY ("review_requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "encounter_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_episodes" ADD CONSTRAINT "encounter_episodes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_signatures" ADD CONSTRAINT "encounter_signatures_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_sections" ADD CONSTRAINT "encounter_sections_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "encounter_diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_treatments" ADD CONSTRAINT "encounter_treatments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_treatments" ADD CONSTRAINT "encounter_treatments_diagnosis_id_fkey" FOREIGN KEY ("diagnosis_id") REFERENCES "encounter_diagnoses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_treatment_outcomes" ADD CONSTRAINT "encounter_treatment_outcomes_encounter_treatment_id_fkey" FOREIGN KEY ("encounter_treatment_id") REFERENCES "encounter_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_catalog_local" ADD CONSTRAINT "condition_catalog_local_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_catalog_local" ADD CONSTRAINT "condition_catalog_local_base_condition_id_fkey" FOREIGN KEY ("base_condition_id") REFERENCES "condition_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_suggestion_logs" ADD CONSTRAINT "condition_suggestion_logs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_tasks" ADD CONSTRAINT "encounter_tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_tasks" ADD CONSTRAINT "encounter_tasks_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_tasks" ADD CONSTRAINT "encounter_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_tasks" ADD CONSTRAINT "encounter_tasks_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_templates" ADD CONSTRAINT "text_templates_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informed_consents" ADD CONSTRAINT "informed_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informed_consents" ADD CONSTRAINT "informed_consents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informed_consents" ADD CONSTRAINT "informed_consents_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informed_consents" ADD CONSTRAINT "informed_consents_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
