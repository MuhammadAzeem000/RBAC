// A thin, hand-written TAXII 2.1 client using native fetch — no maintained
// TAXII 2.1 npm client exists (taxii2-client/cti-taxii-client aren't
// published packages, and stix2 is an object-modeling library, not a
// transport client), and this repo never uses axios elsewhere, so a small
// bespoke client following TAXII 2.1's own REST + media-type spec avoids a
// fragile/unmaintained dependency. See:
// https://docs.oasis-open.org/cti/taxii/v2.1/os/taxii-v2.1-os.html

export interface TaxiiCredentials {
  authType: "none" | "basic" | "bearer";
  username?: string;
  password?: string;
  token?: string;
}

export interface TaxiiApiRoot {
  title: string;
  description?: string;
}

export interface TaxiiDiscovery {
  title: string;
  default?: string;
  api_roots?: string[];
}

export interface TaxiiCollectionSummary {
  id: string;
  title: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
}

export interface StixEnvelopeObject {
  id: string;
  type: string;
  spec_version?: string;
  [key: string]: unknown;
}

export interface PollResult {
  objects: StixEnvelopeObject[];
  more: boolean;
  next?: string;
}

const TAXII_MEDIA_TYPE = "application/taxii+json;version=2.1";
const STIX_MEDIA_TYPE = "application/stix+json;version=2.1";

function authHeader(credentials?: TaxiiCredentials): Record<string, string> {
  if (!credentials || credentials.authType === "none") return {};
  if (credentials.authType === "basic") {
    const encoded = Buffer.from(`${credentials.username ?? ""}:${credentials.password ?? ""}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  return { Authorization: `Bearer ${credentials.token ?? ""}` };
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function getJson<T>(url: string, accept: string, credentials?: TaxiiCredentials): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: accept, ...authHeader(credentials) },
  });
  if (!response.ok) {
    throw new Error(`TAXII request to ${url} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

// GET {discoveryUrl} — the server's own /taxii2/ discovery document, listing
// its available API roots. Returns the first api_root (or `default`) since
// v1 only ever polls one API root per configured server.
export async function discoverApiRoot(discoveryUrl: string, credentials?: TaxiiCredentials): Promise<string> {
  const discovery = await getJson<TaxiiDiscovery>(discoveryUrl, TAXII_MEDIA_TYPE, credentials);
  const apiRoot = discovery.default ?? discovery.api_roots?.[0];
  if (!apiRoot) {
    throw new Error(`TAXII server at ${discoveryUrl} advertised no API roots`);
  }
  return apiRoot;
}

// GET {apiRoot}/collections/
export async function listCollections(
  apiRoot: string,
  credentials?: TaxiiCredentials,
): Promise<TaxiiCollectionSummary[]> {
  const body = await getJson<{ collections: TaxiiCollectionSummary[] }>(
    joinUrl(apiRoot, "collections/"),
    TAXII_MEDIA_TYPE,
    credentials,
  );
  return body.collections ?? [];
}

export interface PollObjectsOptions {
  addedAfter?: Date | null;
  next?: string | null;
  limit?: number;
}

// GET {apiRoot}/collections/{id}/objects/?added_after=...&next=...&limit=...
// Returns one page — the caller (taxiiPoller.service.ts) loops while
// `more` is true, passing the returned `next` cursor back in on the next call.
export async function pollObjects(
  apiRoot: string,
  collectionId: string,
  options: PollObjectsOptions,
  credentials?: TaxiiCredentials,
): Promise<PollResult> {
  const params = new URLSearchParams();
  if (options.addedAfter) params.set("added_after", options.addedAfter.toISOString());
  if (options.next) params.set("next", options.next);
  if (options.limit) params.set("limit", String(options.limit));

  const query = params.toString();
  const url = joinUrl(apiRoot, `collections/${encodeURIComponent(collectionId)}/objects/`) + (query ? `?${query}` : "");

  const body = await getJson<{ objects?: StixEnvelopeObject[]; more?: boolean; next?: string }>(
    url,
    STIX_MEDIA_TYPE,
    credentials,
  );

  return {
    objects: body.objects ?? [],
    more: body.more ?? false,
    next: body.next,
  };
}
