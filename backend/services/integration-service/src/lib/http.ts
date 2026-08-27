const TIMEOUT_MS = 10_000;

// Every connector call goes through this — a bare `fetch` with no timeout
// would let one hung upstream request tie up a Temporal Activity indefinitely.
export async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
