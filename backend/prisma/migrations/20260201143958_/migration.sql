-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_condition_catalog_local" (
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
INSERT INTO "new_condition_catalog_local" ("active", "base_condition_id", "created_at", "hidden", "id", "medico_id", "name", "synonyms", "tags", "updated_at") SELECT "active", "base_condition_id", "created_at", "hidden", "id", "medico_id", "name", "synonyms", "tags", "updated_at" FROM "condition_catalog_local";
DROP TABLE "condition_catalog_local";
ALTER TABLE "new_condition_catalog_local" RENAME TO "condition_catalog_local";
CREATE INDEX "condition_catalog_local_medico_id_idx" ON "condition_catalog_local"("medico_id");
CREATE UNIQUE INDEX "condition_catalog_local_medico_id_base_condition_id_key" ON "condition_catalog_local"("medico_id", "base_condition_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
