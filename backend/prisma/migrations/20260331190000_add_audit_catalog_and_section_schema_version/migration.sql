ALTER TABLE "encounter_sections" ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "audit_logs" ADD COLUMN "reason" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'SUCCESS';

CREATE INDEX "audit_logs_reason_idx" ON "audit_logs"("reason");
CREATE INDEX "audit_logs_result_idx" ON "audit_logs"("result");
