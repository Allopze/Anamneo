CREATE TABLE "medication_catalog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL DEFAULT '',
  "active_ingredient" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "medication_catalog_normalized_name_key" ON "medication_catalog"("normalized_name");