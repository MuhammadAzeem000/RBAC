-- CreateTable
CREATE TABLE "alerts" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "external_alert_id" VARCHAR(150) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "summary" TEXT,
    "severity" VARCHAR(20),
    "occurred_at" TIMESTAMP(6),
    "raw_ref" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending_case',
    "incident_id" BIGINT,
    "error_message" TEXT,
    "attached_by" BIGINT NOT NULL,
    "attached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "alerts_tenant_id_idx" ON "alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "alerts_incident_id_idx" ON "alerts"("incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_tenant_id_source_external_alert_id_key" ON "alerts"("tenant_id", "source", "external_alert_id");

-- CreateIndex
CREATE INDEX "entities_tenant_id_idx" ON "entities"("tenant_id");

-- CreateIndex
CREATE INDEX "entities_alert_id_idx" ON "entities"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
