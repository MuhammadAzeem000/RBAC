export interface ConnectorActionContext {
  credentials: Record<string, unknown>;
  params: Record<string, unknown>;
}

export interface ConnectorActionSuccess {
  result: Record<string, unknown>;
}

// `retryable` is what lets the caller (incident-service's Temporal Activity)
// decide whether Temporal's own retry policy should apply or whether this
// is a deterministic failure (bad credentials, malformed params) that will
// never succeed on retry — see @responderx/shared's ConnectorActionError.
export class ConnectorActionFailure extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "ConnectorActionFailure";
  }
}

export type ConnectorActionHandler = (ctx: ConnectorActionContext) => Promise<ConnectorActionSuccess>;

export interface ConnectorDefinition {
  key: string;
  name: string;
  type: string;
  // Published rate limit for this connector's API — see lib/rateLimiter.ts.
  rateLimit: { maxRequests: number; windowMs: number };
  // Every connector must define a "test" action requiring no params beyond
  // credentials — what POST /connectors/:key/test invokes to validate
  // configuration without side effects.
  actions: Record<string, ConnectorActionHandler> & { test: ConnectorActionHandler };
}
