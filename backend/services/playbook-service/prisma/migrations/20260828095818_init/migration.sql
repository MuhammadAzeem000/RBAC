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
    "start_policy_key" VARCHAR(100),
    "steps" JSON NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "timeout_duration" VARCHAR(50) NOT NULL,
    "escalation_after" VARCHAR(50),
    "escalation_channel" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_playbook_runs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "incident_id" BIGINT NOT NULL,
    "playbook_version_id" BIGINT NOT NULL,
    "playbook_key" VARCHAR(100) NOT NULL,
    "playbook_version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "temporal_workflow_id" VARCHAR(255),
    "state" VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "approvals" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "playbook_run_id" BIGINT NOT NULL,
    "step_key" VARCHAR(100),
    "policy_key" VARCHAR(100) NOT NULL,
    "requestor_user_id" BIGINT NOT NULL,
    "approver_user_id" BIGINT,
    "decision" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "escalated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_executions" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "playbook_run_id" BIGINT NOT NULL,
    "step_key" VARCHAR(100) NOT NULL,
    "step_name" VARCHAR(150) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input" JSON,
    "output" JSON,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(6),
    "ended_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(50) NOT NULL,
    "aggregate_id" VARCHAR(100) NOT NULL,
    "actor_id" VARCHAR(100),
    "actor_type" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "metadata" JSON,
    "payload" JSON,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "policies_tenant_id_idx" ON "policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "policies_tenant_id_key_key" ON "policies"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_tenant_id_idx" ON "incident_playbook_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_incident_id_idx" ON "incident_playbook_runs"("incident_id");

-- CreateIndex
CREATE INDEX "incident_playbook_runs_playbook_version_id_idx" ON "incident_playbook_runs"("playbook_version_id");

-- CreateIndex
CREATE INDEX "approvals_tenant_id_idx" ON "approvals"("tenant_id");

-- CreateIndex
CREATE INDEX "approvals_playbook_run_id_idx" ON "approvals"("playbook_run_id");

-- CreateIndex
CREATE INDEX "approvals_decision_idx" ON "approvals"("decision");

-- CreateIndex
CREATE INDEX "step_executions_tenant_id_idx" ON "step_executions"("tenant_id");

-- CreateIndex
CREATE INDEX "step_executions_playbook_run_id_idx" ON "step_executions"("playbook_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "playbook_versions" ADD CONSTRAINT "playbook_versions_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_playbook_runs" ADD CONSTRAINT "incident_playbook_runs_playbook_version_id_fkey" FOREIGN KEY ("playbook_version_id") REFERENCES "playbook_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_playbook_run_id_fkey" FOREIGN KEY ("playbook_run_id") REFERENCES "incident_playbook_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_executions" ADD CONSTRAINT "step_executions_playbook_run_id_fkey" FOREIGN KEY ("playbook_run_id") REFERENCES "incident_playbook_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
