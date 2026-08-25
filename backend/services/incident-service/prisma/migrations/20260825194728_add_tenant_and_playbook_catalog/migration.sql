/*
  Warnings:

  - Added the required column `tenant_id` to the `incident_alerts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incident_comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incident_evidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `playbook_version_id` to the `incident_playbook_runs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incident_playbook_runs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incident_tasks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incident_timeline_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `incidents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "incident_alerts" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incident_comments" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incident_evidence" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incident_playbook_runs" ADD COLUMN     "playbook_version_id" BIGINT NOT NULL,
ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incident_tasks" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incident_timeline_events" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "tenant_id" BIGINT NOT NULL;

-- CreateTable
CREATE TABLE "playbooks" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_versions" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "playbook_id" BIGINT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSON NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playbooks_tenant_id_idx" ON "playbooks"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_tenant_id_key_key" ON "playbooks"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "playbook_versions_tenant_id_idx" ON "playbook_versions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "playbook_versions_playbook_id_version_key" ON "playbook_versions"("playbook_id", "version");

-- CreateIndex
CREATE INDEX "incident_alerts_tenant_id_idx" ON "incident_alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_comments_tenant_id_idx" ON "incident_comments"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_evidence_tenant_id_idx" ON "incident_evidence"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_tenant_id_idx" ON "incident_playbook_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_playbook_version_id_idx" ON "incident_playbook_runs"("playbook_version_id");

-- CreateIndex
CREATE INDEX "incident_tasks_tenant_id_idx" ON "incident_tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_timeline_events_tenant_id_idx" ON "incident_timeline_events"("tenant_id");

-- CreateIndex
CREATE INDEX "incidents_tenant_id_idx" ON "incidents"("tenant_id");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "incident_playbook_runs" ADD CONSTRAINT "incident_playbook_runs_playbook_version_id_fkey" FOREIGN KEY ("playbook_version_id") REFERENCES "playbook_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_versions" ADD CONSTRAINT "playbook_versions_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
