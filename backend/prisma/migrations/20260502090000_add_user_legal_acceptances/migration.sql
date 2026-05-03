CREATE TABLE "user_legal_acceptances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    CONSTRAINT "user_legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_legal_acceptances_user_id_document_type_version_key" ON "user_legal_acceptances"("user_id", "document_type", "version");
CREATE INDEX "user_legal_acceptances_user_id_document_type_idx" ON "user_legal_acceptances"("user_id", "document_type");
CREATE INDEX "user_legal_acceptances_accepted_at_idx" ON "user_legal_acceptances"("accepted_at");
