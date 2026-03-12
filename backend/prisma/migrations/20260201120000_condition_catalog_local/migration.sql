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
    CONSTRAINT "condition_catalog_local_base_condition_id_fkey" FOREIGN KEY ("base_condition_id") REFERENCES "condition_catalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "condition_catalog_local_medico_id_idx" ON "condition_catalog_local"("medico_id");

-- CreateIndex
CREATE UNIQUE INDEX "condition_catalog_local_medico_id_base_condition_id_key" ON "condition_catalog_local"("medico_id", "base_condition_id");
