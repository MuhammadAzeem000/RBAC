-- Follow-up to 20260826000000_add_tenant_multi_tenancy: OutboxEvent needed
-- tenantId too (writeOutboxEvent's AuditEventInput already required it in
-- code — this migration was missed in the original pass). Same safe
-- nullable-add -> backfill -> not-null sequence, backfilling into the same
-- `default` tenant (id 1) as everything else.

ALTER TABLE "outbox_events" ADD COLUMN "tenant_id" BIGINT;
UPDATE "outbox_events" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "outbox_events" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");
