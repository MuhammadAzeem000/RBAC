-- Phase 5: Alert Ingestion.
-- Hand-authored (not `prisma migrate dev`) because Prisma's non-interactive
-- migrate refuses to confirm the new unique constraint even though it's
-- safe here — verified first: no existing (tenant_id, source,
-- external_alert_id) duplicates in incident_alerts.

-- AlterTable: incident_alerts
ALTER TABLE "incident_alerts" ALTER COLUMN "summary" DROP NOT NULL;
ALTER TABLE "incident_alerts" ADD COLUMN "severity" VARCHAR(20);
ALTER TABLE "incident_alerts" ADD COLUMN "occurred_at" TIMESTAMP(6);
ALTER TABLE "incident_alerts" ADD COLUMN "raw_ref" VARCHAR(500);

CREATE UNIQUE INDEX "incident_alerts_tenant_id_source_external_alert_id_key" ON "incident_alerts"("tenant_id", "source", "external_alert_id");

-- CreateTable
CREATE TABLE "entities" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "alert_id" BIGINT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "attributes" JSON,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entities_tenant_id_idx" ON "entities"("tenant_id");

-- CreateIndex
CREATE INDEX "entities_alert_id_idx" ON "entities"("alert_id");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "incident_alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
