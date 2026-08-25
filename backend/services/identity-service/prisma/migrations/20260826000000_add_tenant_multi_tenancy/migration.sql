-- Phase 1: Domain Foundation & Multi-Tenancy.
-- Hand-authored (not `prisma migrate dev`) because Prisma's non-interactive
-- migrate refuses to add required columns to non-empty tables without a
-- default — this does the safe nullable-add -> backfill -> not-null dance
-- instead, seeding one `default` tenant that every pre-existing row is
-- assigned to.

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- Seed the tenant every pre-existing row (including whatever admin already
-- bootstrapped this system) gets backfilled into.
INSERT INTO "tenants" ("slug", "name", "status") VALUES ('default', 'Default Tenant', 'active');

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN "tenant_id" BIGINT;
UPDATE "users" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;

DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: departments
ALTER TABLE "departments" ADD COLUMN "tenant_id" BIGINT;
UPDATE "departments" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "departments" ALTER COLUMN "tenant_id" SET NOT NULL;

DROP INDEX "departments_name_key";
CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: user_roles
ALTER TABLE "user_roles" ADD COLUMN "tenant_id" BIGINT;
UPDATE "user_roles" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "user_roles" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: user_departments
ALTER TABLE "user_departments" ADD COLUMN "tenant_id" BIGINT;
UPDATE "user_departments" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'default');
ALTER TABLE "user_departments" ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX "user_departments_tenant_id_idx" ON "user_departments"("tenant_id");

ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
