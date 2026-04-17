ALTER TABLE "condition_suggestion_logs"
ADD COLUMN "persisted_text_snapshot" TEXT;

ALTER TABLE "encounter_tasks"
ADD COLUMN "recurrence_source_task_id" TEXT;

ALTER TABLE "encounter_tasks"
ADD COLUMN "recurrence_rule" TEXT NOT NULL DEFAULT 'NONE';

CREATE INDEX "encounter_tasks_recurrence_source_task_id_idx"
ON "encounter_tasks"("recurrence_source_task_id");
