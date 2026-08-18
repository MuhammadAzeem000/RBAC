import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { AttachAlertInput } from "../interfaces/alert";
import { AlertResponse } from "../interfaces/alert-response";

const alertSelect = {
  id: true,
  incidentId: true,
  externalAlertId: true,
  source: true,
  summary: true,
  rawPayload: true,
  attachedBy: true,
  attachedAt: true,
} as const;

// Alerts are immutable source context once attached — there is deliberately
// no update route for this resource, only attach (create) and list.
export function attachAlert(incidentId: bigint, input: AttachAlertInput, actorUserId: bigint): Promise<AlertResponse> {
  return prisma.alert.create({
    data: {
      incidentId,
      externalAlertId: input.externalAlertId,
      source: input.source,
      summary: input.summary,
      rawPayload: input.rawPayload as Prisma.InputJsonValue | undefined,
      attachedBy: actorUserId,
    },
    select: alertSelect,
  });
}

export function listAlerts(incidentId: bigint): Promise<AlertResponse[]> {
  return prisma.alert.findMany({ where: { incidentId }, select: alertSelect, orderBy: { attachedAt: "desc" } });
}
