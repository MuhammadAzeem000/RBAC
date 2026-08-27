// A Prisma Client Extension that structurally enforces tenant isolation: for
// a fixed allowlist of tenant-scoped models, every read/update/delete gets
// `tenantId` merged into its filter and every create gets `tenantId` stamped
// onto its data — so a service-layer function that simply forgets to filter
// by tenant can no longer leak across tenants, because the client it's
// holding cannot run an unscoped query against those models at all.
//
// Why untyped against a specific PrismaClient: each backend service
// generates its own Prisma Client into its own `src/generated/prisma`
// (different schema, different types, different output path per service —
// see each service's `schema.prisma` generator block). A single shared
// helper can't import a concrete `PrismaClient` type without coupling every
// service to one service's generated types, so this operates structurally
// (via Prisma's own `$extends` API, which every generated client exposes
// with the same shape) rather than nominally. The tenant-isolation
// integration tests are what actually prove this works per service, not the
// TypeScript compiler.
//
// findUnique/update/delete take a UNIQUE `where` (Prisma rejects extra
// filter fields there), so tenantId can't be merged into their `where` the
// way it can for findFirst/findMany/updateMany/deleteMany. Existing
// call sites in this codebase already use findFirst instead of findUnique
// for exactly this reason (to combine a unique lookup with a soft-delete
// filter) — keep doing that. For update/delete specifically, this extension
// runs a tenant-scoped existence check first and only then performs the
// original, unmodified unique-keyed operation; the id itself is already
// globally unique, so once ownership is confirmed the mutation can safely
// proceed unchanged.

type AnyRecord = Record<string, unknown>;

interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: AnyRecord;
  query: (args: AnyRecord) => Promise<unknown>;
}

interface ExtendableClient {
  $extends: (extension: AnyRecord) => unknown;
}

const FILTER_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// "upsert" is handled by its own branch above, not here — a missing row is
// its legitimate create-path, not a "not found" error like the rest of these.
const UNIQUE_KEYED_OPERATIONS = new Set(["update", "delete", "findUnique", "findUniqueOrThrow"]);

function mergeWhere(args: AnyRecord, tenantId: string): AnyRecord {
  return { ...args, where: { ...(args.where as AnyRecord | undefined), tenantId } };
}

// A Prisma `WhereUniqueInput` (what upsert/update/delete/findUnique take)
// represents a compound unique constraint as a nested wrapper —
// `{ tenantId_key: { tenantId, key } }` — which is NOT valid syntax for a
// filter-style `where` like findFirst's; findFirst needs the compound
// field's own members flattened to the top level instead:
// `{ tenantId, key }`. WhereUniqueInput can only ever contain direct scalar
// equality or exactly this compound-wrapper shape — never a filter operator
// object like `{ gt: 5 }` — so flattening every nested plain-object value
// unconditionally is safe here (this must NOT be reused against a general
// filter `where`, only against a WhereUniqueInput being adapted into one).
function flattenUniqueWhere(where: AnyRecord | undefined): AnyRecord {
  const flattened: AnyRecord = {};
  for (const [key, value] of Object.entries(where ?? {})) {
    if (value !== null && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
      Object.assign(flattened, value as AnyRecord);
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
}

function stampCreateData(args: AnyRecord, tenantId: string): AnyRecord {
  const data = args.data;
  if (Array.isArray(data)) {
    return { ...args, data: data.map((row) => ({ ...(row as AnyRecord), tenantId })) };
  }
  return { ...args, data: { ...(data as AnyRecord | undefined), tenantId } };
}

function clientProperty(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Returns a tenant-scoped client. Pass `tenantId: null` ONLY for a request
 * already verified to hold the Platform Operator role — never in response to
 * a client-supplied header or parameter, since that would be exactly the
 * bypass this extension exists to prevent.
 */
export function forTenant<TClient extends ExtendableClient>(
  client: TClient,
  tenantId: string | bigint | null,
  scopedModels: readonly string[],
): TClient {
  if (tenantId === null) return client;

  const tenantIdValue = tenantId.toString();
  const scoped = new Set(scopedModels);

  const extended = client.$extends({
    name: "tenant-scope",
    query: {
      async $allOperations({ model, operation, args, query }: AllOperationsArgs) {
        if (!model || !scoped.has(model)) {
          return query(args);
        }

        if (FILTER_OPERATIONS.has(operation)) {
          return query(mergeWhere(args, tenantIdValue));
        }

        if (operation === "create") {
          return query(stampCreateData(args, tenantIdValue));
        }

        if (operation === "createMany") {
          return query(stampCreateData(args, tenantIdValue));
        }

        if (operation === "upsert") {
          // Unlike update/delete/findUnique below, a missing row here is
          // the legitimate create-path, not an error — throwing "not
          // found" would break upsert's entire reason for existing. Only
          // check ownership when a row DOES already exist (its `where`
          // matched something), so a cross-tenant id can't be upserted
          // into; a genuinely new row just gets tenantId stamped and created.
          const delegate = (client as unknown as AnyRecord)[clientProperty(model)] as {
            findFirst: (a: AnyRecord) => Promise<AnyRecord | null>;
          };
          const existing = await delegate.findFirst({ where: flattenUniqueWhere(args.where as AnyRecord) });
          if (existing && existing.tenantId?.toString() !== tenantIdValue) {
            throw new Error(`${model} not found`);
          }
          if (args.create) {
            args = { ...args, create: { ...(args.create as AnyRecord), tenantId: tenantIdValue } };
          }
          return query(args);
        }

        if (UNIQUE_KEYED_OPERATIONS.has(operation)) {
          const delegate = (client as unknown as AnyRecord)[clientProperty(model)] as {
            findFirst: (a: AnyRecord) => Promise<unknown>;
          };
          const owned = await delegate.findFirst({
            where: { ...flattenUniqueWhere(args.where as AnyRecord), tenantId: tenantIdValue },
          });
          if (!owned) {
            throw new Error(`${model} not found`);
          }
          return query(args);
        }

        return query(args);
      },
    },
  });

  return extended as TClient;
}
