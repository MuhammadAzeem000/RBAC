// A minimal in-memory sliding-window limiter, keyed per connector — enough
// to respect each connector's published rate limit (Slack ~1 req/sec,
// VirusTotal's free tier 4 req/min) without adding Redis to this stack for
// one counter. Documented limitation: per-process only, so it doesn't
// coordinate across multiple integration-service instances — acceptable for
// this phase (there's only ever one instance running), revisit if/when this
// service is horizontally scaled.
interface Window {
  timestamps: number[];
}

const windows = new Map<string, Window>();

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitExceededError";
  }
}

/**
 * Throws RateLimitExceededError if `key` has already made `maxRequests`
 * calls within the trailing `windowMs`; otherwise records this call and
 * returns.
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  const window = windows.get(key) ?? { timestamps: [] };
  window.timestamps = window.timestamps.filter((ts) => now - ts < windowMs);

  if (window.timestamps.length >= maxRequests) {
    const oldest = window.timestamps[0];
    throw new RateLimitExceededError(windowMs - (now - oldest));
  }

  window.timestamps.push(now);
  windows.set(key, window);
}
