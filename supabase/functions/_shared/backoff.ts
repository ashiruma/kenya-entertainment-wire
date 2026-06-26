// Shared exponential backoff + jitter for AI gateway calls.
// Centralizes 429 handling across edge functions so behavior is consistent.

export type BackoffOpts = {
  maxAttempts?: number;
  baseMs?: number;
  capMs?: number;
  // Called before each sleep — useful for logging attempts to a DB.
  onRetry?: (info: { attempt: number; status: number; delayMs: number; retryAfterMs: number | null; error?: string }) => void | Promise<void>;
};

export type FetchResult = {
  response: Response | null;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  nextRetryAt: string | null; // ISO timestamp of the next attempt if we gave up mid-wait (null otherwise)
};

function computeDelay(attempt: number, retryAfterMs: number | null, baseMs: number, capMs: number): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(capMs, retryAfterMs);
  // Full jitter: random in [0, min(cap, base * 2^(attempt-1))]
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}

function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.floor(n * 1000);
  const d = Date.parse(h);
  if (Number.isFinite(d)) return Math.max(0, d - Date.now());
  return null;
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  opts: BackoffOpts = {},
): Promise<FetchResult> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseMs = opts.baseMs ?? 1000;
  const capMs = opts.capMs ?? 8000;

  let lastStatus: number | null = null;
  let lastError: string | null = null;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(url, init);
      lastStatus = response.status;
      // Retry on 429 and 5xx transients
      const transient = response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!transient || attempt === maxAttempts) {
        return { response, attempts: attempt, lastStatus, lastError, nextRetryAt: null };
      }
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      const delayMs = computeDelay(attempt, retryAfterMs, baseMs, capMs);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
      await opts.onRetry?.({ attempt, status: response.status, delayMs, retryAfterMs, error: `HTTP ${response.status}` });
      // Drain the body so the connection can be reused
      try { await response.text(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, delayMs));
      // After sleep, loop and retry. nextRetryAt is informational only.
      void nextRetryAt;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === maxAttempts) {
        return { response: null, attempts: attempt, lastStatus, lastError, nextRetryAt: null };
      }
      const delayMs = computeDelay(attempt, null, baseMs, capMs);
      await opts.onRetry?.({ attempt, status: 0, delayMs, retryAfterMs: null, error: lastError });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { response, attempts: maxAttempts, lastStatus, lastError, nextRetryAt: null };
}