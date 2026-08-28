-- Phase 5.2: Playbook/Orchestration/Approval ownership moves to the new
-- playbook-service (see backend/services/playbook-service/prisma/schema.prisma,
-- which carries the same shape forward, minus the incident_id -> incidents
-- FK — that becomes a plain column there, same "no cross-DB FK" precedent
-- as alert-ingestion-service's Alert.incidentId). This service now only
-- ever reaches playbook runs/approvals indirectly, via the new
-- machine-to-machine POST /api/v1/incidents/:id/timeline route
-- (src/middlewares/requireServiceToken.ts).
--
-- Hand-authored (not `prisma migrate dev`) because this drops data.
-- Verified first (2026-08-28): 13 rows in incident_playbook_runs, 27 in
-- step_executions, 3 in approvals, 2 in policies, 10 in playbooks/
-- playbook_versions — Phase 1-5.1 smoke-test data only, confirmed
-- acceptable loss. None were in a "running"/"pending_approval" state.

-- DropForeignKey
ALTER TABLE "step_executions" DROP CONSTRAINT "step_executions_playbook_run_id_fkey";

-- DropForeignKey
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_playbook_run_id_fkey";

-- DropForeignKey
ALTER TABLE "incident_playbook_runs" DROP CONSTRAINT "incident_playbook_runs_incident_id_fkey";

-- DropForeignKey
ALTER TABLE "incident_playbook_runs" DROP CONSTRAINT "incident_playbook_runs_playbook_version_id_fkey";

-- DropForeignKey
ALTER TABLE "playbook_versions" DROP CONSTRAINT "playbook_versions_playbook_id_fkey";

-- DropTable
DROP TABLE "step_executions";

-- DropTable
DROP TABLE "approvals";

-- DropTable
DROP TABLE "incident_playbook_runs";

-- DropTable
DROP TABLE "playbook_versions";

-- DropTable
DROP TABLE "playbooks";

-- DropTable
DROP TABLE "policies";
