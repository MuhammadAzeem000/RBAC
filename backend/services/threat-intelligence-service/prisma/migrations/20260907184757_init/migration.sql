-- CreateTable
CREATE TABLE "taxii_servers" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "discovery_url" VARCHAR(500) NOT NULL,
    "api_root" VARCHAR(500),
    "auth_type" VARCHAR(20) NOT NULL DEFAULT 'none',
    "encrypted_credential" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'enabled',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "taxii_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxii_collections" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "taxii_server_id" BIGINT NOT NULL,
    "collection_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255),
    "poll_interval_seconds" INTEGER NOT NULL DEFAULT 900,
    "status" VARCHAR(20) NOT NULL DEFAULT 'enabled',
    "last_added_after" TIMESTAMP(6),
    "last_next_token" VARCHAR(500),
    "last_polled_at" TIMESTAMP(6),
    "last_poll_status" VARCHAR(20),
    "last_poll_error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "taxii_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stix_objects" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "stix_id" VARCHAR(255) NOT NULL,
    "spec_version" VARCHAR(10) NOT NULL DEFAULT '2.1',
    "type" VARCHAR(50) NOT NULL,
    "ioc_type" VARCHAR(50),
    "ioc_value" VARCHAR(2048),
    "pattern" TEXT,
    "labels" TEXT[],
    "confidence" INTEGER,
    "first_seen" TIMESTAMP(6),
    "last_seen" TIMESTAMP(6),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,
    "taxii_server_id" BIGINT,
    "taxii_collection_id" BIGINT,
    "source_feed_name" VARCHAR(255),
    "ingested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "stix_objects_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "taxii_servers_tenant_id_idx" ON "taxii_servers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxii_servers_tenant_id_discovery_url_key" ON "taxii_servers"("tenant_id", "discovery_url");

-- CreateIndex
CREATE INDEX "taxii_collections_tenant_id_idx" ON "taxii_collections"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxii_collections_tenant_id_taxii_server_id_collection_id_key" ON "taxii_collections"("tenant_id", "taxii_server_id", "collection_id");

-- CreateIndex
CREATE INDEX "stix_objects_tenant_id_type_idx" ON "stix_objects"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "stix_objects_tenant_id_ioc_type_ioc_value_idx" ON "stix_objects"("tenant_id", "ioc_type", "ioc_value");

-- CreateIndex
CREATE INDEX "stix_objects_tenant_id_taxii_collection_id_idx" ON "stix_objects"("tenant_id", "taxii_collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "stix_objects_tenant_id_stix_id_key" ON "stix_objects"("tenant_id", "stix_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- AddForeignKey
ALTER TABLE "taxii_collections" ADD CONSTRAINT "taxii_collections_taxii_server_id_fkey" FOREIGN KEY ("taxii_server_id") REFERENCES "taxii_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
