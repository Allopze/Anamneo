CREATE TABLE "audit_integrity_snapshots" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "valid" BOOLEAN NOT NULL,
  "checked" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "broken_at" TEXT,
  "warning" TEXT,
  "verification_scope" TEXT NOT NULL,
  "verified_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
