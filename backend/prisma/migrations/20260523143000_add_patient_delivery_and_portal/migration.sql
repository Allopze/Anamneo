-- Temporary audited delivery links for data-subject medical record exports.
CREATE TABLE "patient_data_request_downloads" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "encryption_envelope" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 3,
    "revoked_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_data_request_downloads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_data_request_downloads_token_hash_key" ON "patient_data_request_downloads"("token_hash");
CREATE INDEX "patient_data_request_downloads_request_id_idx" ON "patient_data_request_downloads"("request_id");
CREATE INDEX "patient_data_request_downloads_patient_id_idx" ON "patient_data_request_downloads"("patient_id");
CREATE INDEX "patient_data_request_downloads_expires_at_idx" ON "patient_data_request_downloads"("expires_at");

ALTER TABLE "patient_data_request_downloads"
  ADD CONSTRAINT "patient_data_request_downloads_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "patient_data_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_data_request_downloads"
  ADD CONSTRAINT "patient_data_request_downloads_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_data_request_downloads"
  ADD CONSTRAINT "patient_data_request_downloads_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Patient portal accounts are deliberately separate from internal users.
CREATE TABLE "patient_portal_accounts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "relationship" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "activation_token_hash" TEXT,
    "activation_expires_at" TIMESTAMP(3),
    "legal_accepted_at" TIMESTAMP(3),
    "legal_acceptance" JSONB,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "refresh_token_version" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_portal_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_portal_accounts_email_key" ON "patient_portal_accounts"("email");
CREATE UNIQUE INDEX "patient_portal_accounts_activation_token_hash_key" ON "patient_portal_accounts"("activation_token_hash");
CREATE INDEX "patient_portal_accounts_patient_id_idx" ON "patient_portal_accounts"("patient_id");
CREATE INDEX "patient_portal_accounts_active_idx" ON "patient_portal_accounts"("active");

ALTER TABLE "patient_portal_accounts"
  ADD CONSTRAINT "patient_portal_accounts_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_portal_accounts"
  ADD CONSTRAINT "patient_portal_accounts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "patient_portal_sessions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_portal_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patient_portal_sessions_account_id_revoked_at_idx" ON "patient_portal_sessions"("account_id", "revoked_at");

ALTER TABLE "patient_portal_sessions"
  ADD CONSTRAINT "patient_portal_sessions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "patient_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "patient_portal_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "patient_portal_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_portal_password_reset_tokens_token_hash_key" ON "patient_portal_password_reset_tokens"("token_hash");
CREATE INDEX "patient_portal_password_reset_tokens_account_id_used_at_idx" ON "patient_portal_password_reset_tokens"("account_id", "used_at");
CREATE INDEX "patient_portal_password_reset_tokens_expires_at_idx" ON "patient_portal_password_reset_tokens"("expires_at");

ALTER TABLE "patient_portal_password_reset_tokens"
  ADD CONSTRAINT "patient_portal_password_reset_tokens_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "patient_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
