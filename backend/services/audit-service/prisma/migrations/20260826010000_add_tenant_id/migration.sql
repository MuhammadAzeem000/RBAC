-- Phase 1: Multi-Tenancy.
-- Hand-authored (not `prisma migrate dev`) because Prisma's non-interactive
-- migrate refuses to add a required column to a non-empty table without a
-- default — audit_logs already has existing rows, so this does the safe
-- nullable-add -> backfill -> not-null dance instead, assigning every
-- pre-existing row to tenant id 1 (the "default" tenant seeded by
-- identity-service's own tenant-multi-tenancy migration).

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" BIGINT;
UPDATE "audit_logs" SET "tenant_id" = 1;
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
