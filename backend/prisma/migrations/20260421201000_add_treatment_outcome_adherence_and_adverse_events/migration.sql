ALTER TABLE "encounter_treatment_outcomes"
ADD COLUMN "adherence_status" TEXT;

ALTER TABLE "encounter_treatment_outcomes"
ADD COLUMN "adverse_event_severity" TEXT;

ALTER TABLE "encounter_treatment_outcomes"
ADD COLUMN "adverse_event_notes" TEXT;