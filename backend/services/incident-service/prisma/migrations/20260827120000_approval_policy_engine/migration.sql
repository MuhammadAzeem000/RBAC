-- Phase 4: Approval & Policy Engine.
-- Hand-authored (not `prisma migrate dev`) because two existing rows in
-- incident_playbook_runs have non-null approved_by/approved_at, and
-- Prisma's non-interactive migrate refuses to confirm a destructive column
-- drop on non-empty data — that data isn't migrated forward: the two rows
-- in question are Phase 1-3 smoke-test runs, and the new Approval table
-- starts empty rather than backfilling synthetic history for them.

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

-- CreateIndex
CREATE UNIQUE INDEX "policies_tenant_id_key_key" ON "policies"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "policies_tenant_id_idx" ON "policies"("tenant_id");

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

-- CreateIndex
CREATE INDEX "approvals_tenant_id_idx" ON "approvals"("tenant_id");

-- CreateIndex
CREATE INDEX "approvals_playbook_run_id_idx" ON "approvals"("playbook_run_id");

-- CreateIndex
CREATE INDEX "approvals_decision_idx" ON "approvals"("decision");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_playbook_run_id_fkey" FOREIGN KEY ("playbook_run_id") REFERENCES "incident_playbook_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: playbook_versions gains start_policy_key
ALTER TABLE "playbook_versions" ADD COLUMN "start_policy_key" VARCHAR(100);

-- AlterTable: incident_playbook_runs loses approved_by/approved_at (superseded by "approvals")
ALTER TABLE "incident_playbook_runs" DROP COLUMN "approved_by";
ALTER TABLE "incident_playbook_runs" DROP COLUMN "approved_at";
