-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "incidents" (
    "id" BIGSERIAL NOT NULL,
    "external_id" VARCHAR(100),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "severity" VARCHAR(20) NOT NULL,
    "priority" VARCHAR(20),
    "status" VARCHAR(30) NOT NULL DEFAULT 'new',
    "tags" JSON,
    "source" VARCHAR(100),
    "owner_user_id" BIGINT,
    "detected_at" TIMESTAMP(6),
    "due_at" TIMESTAMP(6),
    "resolved_at" TIMESTAMP(6),
    "closed_at" TIMESTAMP(6),
    "closure_code" VARCHAR(50),
    "resolution_summary" TEXT,
    "root_cause" TEXT,
    "created_by" BIGINT NOT NULL,
    "updated_by" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_alerts" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "external_alert_id" VARCHAR(150) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "summary" TEXT NOT NULL,
    "raw_payload" JSON,
    "attached_by" BIGINT NOT NULL,
    "attached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_tasks" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "assignee_user_id" BIGINT,
    "due_date" TIMESTAMP(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMP(6),
    "completed_by" BIGINT,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "incident_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_evidence" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "storage_ref" VARCHAR(500) NOT NULL,
    "checksum" VARCHAR(128),
    "provenance" TEXT,
    "uploaded_by" BIGINT NOT NULL,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_comments" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "author_user_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(6),

    CONSTRAINT "incident_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_playbook_runs" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "playbook_key" VARCHAR(100) NOT NULL,
    "playbook_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "state" VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" BIGINT,
    "approved_at" TIMESTAMP(6),
    "initiated_by" BIGINT NOT NULL,
    "started_at" TIMESTAMP(6),
    "ended_at" TIMESTAMP(6),
    "inputs" JSON,
    "outputs_summary" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_playbook_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timeline_events" (
    "id" BIGSERIAL NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_user_id" BIGINT,
    "summary" TEXT NOT NULL,
    "metadata" JSON,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");

-- CreateIndex
CREATE INDEX "incidents_owner_user_id_idx" ON "incidents"("owner_user_id");

-- CreateIndex
CREATE INDEX "incidents_created_at_idx" ON "incidents"("created_at");

-- CreateIndex
CREATE INDEX "incident_alerts_incident_id_idx" ON "incident_alerts"("incident_id");

-- CreateIndex
CREATE INDEX "incident_tasks_incident_id_idx" ON "incident_tasks"("incident_id");

-- CreateIndex
CREATE INDEX "incident_evidence_incident_id_idx" ON "incident_evidence"("incident_id");

-- CreateIndex
CREATE INDEX "incident_comments_incident_id_idx" ON "incident_comments"("incident_id");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_incident_id_idx" ON "incident_playbook_runs"("incident_id");

-- CreateIndex
CREATE INDEX "incident_timeline_events_incident_id_idx" ON "incident_timeline_events"("incident_id");

-- CreateIndex
CREATE INDEX "incident_timeline_events_created_at_idx" ON "incident_timeline_events"("created_at");

-- AddForeignKey
ALTER TABLE "incident_alerts" ADD CONSTRAINT "incident_alerts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tasks" ADD CONSTRAINT "incident_tasks_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_evidence" ADD CONSTRAINT "incident_evidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_comments" ADD CONSTRAINT "incident_comments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_playbook_runs" ADD CONSTRAINT "incident_playbook_runs_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

