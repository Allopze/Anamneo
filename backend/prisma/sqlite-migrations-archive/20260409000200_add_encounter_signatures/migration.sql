-- CreateTable
CREATE TABLE "encounter_signatures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature_type" TEXT NOT NULL DEFAULT 'FES',
    "content_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    "revoked_reason" TEXT,
    CONSTRAINT "encounter_signatures_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
