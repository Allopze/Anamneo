-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    "deleted_by_id" TEXT,
    CONSTRAINT "attachments_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attachments_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_attachments" ("category", "description", "encounter_id", "filename", "id", "linked_order_id", "linked_order_label", "linked_order_type", "mime", "original_name", "size", "storage_path", "uploaded_at", "uploaded_by_id") SELECT "category", "description", "encounter_id", "filename", "id", "linked_order_id", "linked_order_label", "linked_order_type", "mime", "original_name", "size", "storage_path", "uploaded_at", "uploaded_by_id" FROM "attachments";
DROP TABLE "attachments";
ALTER TABLE "new_attachments" RENAME TO "attachments";
CREATE INDEX "attachments_encounter_id_linked_order_type_linked_order_id_idx" ON "attachments"("encounter_id", "linked_order_type", "linked_order_id");
CREATE INDEX "attachments_deleted_at_idx" ON "attachments"("deleted_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
