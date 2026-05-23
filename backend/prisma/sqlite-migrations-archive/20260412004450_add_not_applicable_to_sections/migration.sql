-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_encounter_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounter_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "encounter_sections_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_encounter_sections" ("completed", "data", "encounter_id", "id", "schema_version", "section_key", "updated_at") SELECT "completed", "data", "encounter_id", "id", "schema_version", "section_key", "updated_at" FROM "encounter_sections";
DROP TABLE "encounter_sections";
ALTER TABLE "new_encounter_sections" RENAME TO "encounter_sections";
CREATE UNIQUE INDEX "encounter_sections_encounter_id_section_key_key" ON "encounter_sections"("encounter_id", "section_key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
