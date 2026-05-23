ALTER TABLE "audit_logs" ADD COLUMN "chain_sequence" INTEGER;

CREATE UNIQUE INDEX "audit_logs_chain_sequence_key" ON "audit_logs"("chain_sequence");

CREATE TABLE "audit_chain_state" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "latest_hash" TEXT NOT NULL DEFAULT 'GENESIS',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "audit_chain_state" ("id", "latest_hash", "sequence", "updated_at")
VALUES (
  'default',
  COALESCE(
    (
      SELECT "integrity_hash"
      FROM "audit_logs"
      WHERE "integrity_hash" IS NOT NULL
      ORDER BY "timestamp" DESC
      LIMIT 1
    ),
    'GENESIS'
  ),
  (SELECT COUNT(*) FROM "audit_logs"),
  CURRENT_TIMESTAMP
);
