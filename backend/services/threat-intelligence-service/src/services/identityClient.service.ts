import { env } from "../config/env";

export interface MyModulePermissions {
  name: string;
  isEnabled: boolean;
  actions: string[];
}

// This service has no RBAC tables of its own — identity-service is the
// single source of permission truth. Forwards the caller's own access token
// (server-to-server) to identity-service's existing
// GET /api/auth/me/modules — same pattern as every other service's own
// identityClient.service.ts.
export async function fetchMyPermissions(accessToken: string): Promise<MyModulePermissions[] | null> {
  const response = await fetch(`${env.IDENTITY_SERVICE_URL}/api/auth/me/modules`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const body = (await response.json()) as { data: MyModulePermissions[] };
  return body.data;
}
