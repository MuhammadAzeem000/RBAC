/*
  Warnings:

  - Added the required column `tenant_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");
