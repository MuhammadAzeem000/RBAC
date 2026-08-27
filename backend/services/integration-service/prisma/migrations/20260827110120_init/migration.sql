-- CreateTable
CREATE TABLE "connectors" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'disabled',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_credentials" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "connector_id" BIGINT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_results" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "connector" VARCHAR(50) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "request_ref" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL,
    "result" JSON,
    "error" TEXT,
    "retryable" BOOLEAN,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_results_pkey" PRIMARY KEY ("id")
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
    "actor_type" VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
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
CREATE INDEX "connectors_tenant_id_idx" ON "connectors"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "connectors_tenant_id_key_key" ON "connectors"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "connector_credentials_connector_id_key" ON "connector_credentials"("connector_id");

-- CreateIndex
CREATE INDEX "connector_credentials_tenant_id_idx" ON "connector_credentials"("tenant_id");

-- CreateIndex
CREATE INDEX "action_results_tenant_id_idx" ON "action_results"("tenant_id");

-- CreateIndex
CREATE INDEX "action_results_connector_action_idx" ON "action_results"("connector", "action");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
