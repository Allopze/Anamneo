ALTER TABLE "condition_suggestion_logs"
ADD COLUMN "ranking_version" TEXT NOT NULL DEFAULT '2026-04-name-synonyms-tags-v1';

ALTER TABLE "condition_suggestion_logs"
ADD COLUMN "ranking_metadata" TEXT NOT NULL DEFAULT '{}';