import { TenantScopedPrisma } from "../middlewares/tenantContext";
import { encryptCredential } from "../lib/crypto";
import { TaxiiCredentials } from "../lib/taxiiClient";

export interface CreateTaxiiServerInput {
  name: string;
  discoveryUrl: string;
  authType: "none" | "basic" | "bearer";
  credential?: Record<string, unknown>;
}

export async function createTaxiiServer(db: TenantScopedPrisma, tenantId: bigint, input: CreateTaxiiServerInput) {
  return db.taxiiServer.create({
    data: {
      tenantId,
      name: input.name,
      discoveryUrl: input.discoveryUrl,
      authType: input.authType,
      encryptedCredential: input.credential ? encryptCredential(input.credential) : null,
    },
  });
}

// Never returns the encrypted credential itself — only whether one is
// configured — same principle as integration-service's ConnectorCredential
// handling.
export function serializeTaxiiServer(server: {
  id: bigint;
  name: string;
  discoveryUrl: string;
  apiRoot: string | null;
  authType: string;
  encryptedCredential: string | null;
  status: string;
}) {
  return {
    id: server.id.toString(),
    name: server.name,
    discoveryUrl: server.discoveryUrl,
    apiRoot: server.apiRoot,
    authType: server.authType,
    credentialConfigured: server.encryptedCredential !== null,
    status: server.status,
  };
}

export function toTaxiiCredentials(
  authType: string,
  encryptedCredential: string | null,
  decryptCredential: (encoded: string) => Record<string, unknown>,
): TaxiiCredentials | undefined {
  if (authType === "none" || !encryptedCredential) return { authType: "none" };
  const decoded = decryptCredential(encryptedCredential);
  if (authType === "basic") {
    return { authType: "basic", username: decoded.username as string, password: decoded.password as string };
  }
  return { authType: "bearer", token: decoded.token as string };
}
