ALTER TABLE "attachments" ADD COLUMN "linked_order_type" TEXT;
ALTER TABLE "attachments" ADD COLUMN "linked_order_id" TEXT;
ALTER TABLE "attachments" ADD COLUMN "linked_order_label" TEXT;

CREATE INDEX "attachments_encounter_id_linked_order_type_linked_order_id_idx"
ON "attachments"("encounter_id", "linked_order_type", "linked_order_id");
