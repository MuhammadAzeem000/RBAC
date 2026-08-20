-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "event_id" VARCHAR(36) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "service" VARCHAR(50) NOT NULL,
    "actor_id" VARCHAR(100),
    "actor_type" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "metadata" JSON,
    "payload" JSON,
    "occurred_at" TIMESTAMP(6) NOT NULL,
    "received_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_event_id_key" ON "audit_logs"("event_id");

-- CreateIndex
CREATE INDEX "audit_logs_service_idx" ON "audit_logs"("service");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

