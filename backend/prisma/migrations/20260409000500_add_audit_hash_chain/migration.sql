-- Add hash chain columns to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "integrity_hash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "previous_hash" TEXT;
