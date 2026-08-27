-- AlterTable
ALTER TABLE "incident_playbook_runs" ADD COLUMN     "temporal_workflow_id" VARCHAR(255);

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
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(6),
    "ended_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "step_executions_tenant_id_idx" ON "step_executions"("tenant_id");

-- CreateIndex
CREATE INDEX "step_executions_playbook_run_id_idx" ON "step_executions"("playbook_run_id");

-- AddForeignKey
ALTER TABLE "step_executions" ADD CONSTRAINT "step_executions_playbook_run_id_fkey" FOREIGN KEY ("playbook_run_id") REFERENCES "incident_playbook_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
