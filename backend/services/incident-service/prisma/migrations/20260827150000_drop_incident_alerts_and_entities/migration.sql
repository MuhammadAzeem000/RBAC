-- Phase 5.1: Alert/Entity ownership moves to the new alert-ingestion-service
-- (see backend/services/alert-ingestion-service/prisma/schema.prisma, which
-- carries the same shape forward). This service now only ever reaches
-- alerts/entities indirectly, via the alert.events saga
-- (src/events/alertConsumer.ts).
--
-- Hand-authored (not `prisma migrate dev`) because this drops data.
-- Verified first (2026-08-27): only 7 rows in incident_alerts and 6 in
-- entities — Phase 1-5 smoke-test data only, confirmed acceptable loss.

-- DropForeignKey
ALTER TABLE "entities" DROP CONSTRAINT "entities_alert_id_fkey";

-- DropForeignKey
ALTER TABLE "incident_alerts" DROP CONSTRAINT "incident_alerts_incident_id_fkey";

-- DropTable
DROP TABLE "entities";

-- DropTable
DROP TABLE "incident_alerts";
