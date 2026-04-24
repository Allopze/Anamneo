PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_encounters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "review_status" TEXT NOT NULL DEFAULT 'NO_REQUIERE_REVISION',
    "review_requested_at" DATETIME,
    "review_requested_by_id" TEXT,
    "reviewed_at" DATETIME,
    "reviewed_by_id" TEXT,
    "review_note" TEXT,
    "completed_at" DATETIME,
    "completed_by_id" TEXT,
    "closure_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "episode_id" TEXT,
    CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "encounters_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "encounters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "encounters_review_requested_by_id_fkey" FOREIGN KEY ("review_requested_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "encounters_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "encounters_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "encounters_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "encounter_episodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_encounters" (
    "id",
    "patient_id",
    "medico_id",
    "created_by_id",
    "status",
    "review_status",
    "review_requested_at",
    "review_requested_by_id",
    "reviewed_at",
    "reviewed_by_id",
    "review_note",
    "completed_at",
    "completed_by_id",
    "closure_note",
    "created_at",
    "updated_at",
    "episode_id"
)
SELECT
    "id",
    "patient_id",
    "medico_id",
    "created_by_id",
    "status",
    "review_status",
    "review_requested_at",
    "review_requested_by_id",
    "reviewed_at",
    "reviewed_by_id",
    "review_note",
    "completed_at",
    "completed_by_id",
    "closure_note",
    "created_at",
    "updated_at",
    "episode_id"
FROM "encounters";

DROP TABLE "encounters";
ALTER TABLE "new_encounters" RENAME TO "encounters";
CREATE INDEX "encounters_medico_id_idx" ON "encounters"("medico_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
