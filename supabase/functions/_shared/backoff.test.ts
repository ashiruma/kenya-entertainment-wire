import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchWithBackoff } from "./backoff.ts";

// Helper: install a fake fetch that returns a queued sequence of responses.
function withFakeFetch(sequence: Array<() => Response>) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  let i = 0;
  globalThis.fetch = ((_url: string) => {
    calls.push(_url);
    const next = sequence[Math.min(i, sequence.length - 1)];
    i += 1;
    return Promise.resolve(next());
  }) as typeof fetch;
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
  };
}

Deno.test("fetchWithBackoff retries 429 then succeeds, honoring retry-after", async () => {
  const f = withFakeFetch([
    () => new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }),
    () => new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }),
    () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
  ]);
  const retries: number[] = [];
  try {
    const res = await fetchWithBackoff("http://x", { method: "POST" }, {
      baseMs: 1, capMs: 5, maxAttempts: 4,
      onRetry: ({ attempt, status }) => { retries.push(attempt); assertEquals(status, 429); },
    });
    assert(res.response, "expected a response");
    assertEquals(res.response!.status, 200);
    assertEquals(res.attempts, 3);
    assertEquals(retries, [1, 2]); // two retries before success
    await res.response!.text();
  } finally {
    f.restore();
  }
});

Deno.test("fetchWithBackoff retries on 5xx transient errors", async () => {
  const f = withFakeFetch([
    () => new Response("boom", { status: 503 }),
    () => new Response("ok", { status: 200 }),
  ]);
  try {
    const res = await fetchWithBackoff("http://x", {}, { baseMs: 1, capMs: 2, maxAttempts: 3 });
    assertEquals(res.response!.status, 200);
    assertEquals(res.attempts, 2);
    await res.response!.text();
  } finally {
    f.restore();
  }
});

Deno.test("fetchWithBackoff stops after maxAttempts and returns last 429", async () => {
  const f = withFakeFetch([
    () => new Response("rl", { status: 429, headers: { "retry-after": "0" } }),
  ]);
  try {
    const res = await fetchWithBackoff("http://x", {}, { baseMs: 1, capMs: 2, maxAttempts: 3 });
    assertEquals(res.attempts, 3);
    assertEquals(res.response!.status, 429);
    assertEquals(res.lastStatus, 429);
    await res.response!.text();
  } finally {
    f.restore();
  }
});

Deno.test("fetchWithBackoff does NOT retry on 4xx non-429 (e.g. 402 credits)", async () => {
  const f = withFakeFetch([
    () => new Response("payment required", { status: 402 }),
    () => new Response("should not be called", { status: 200 }),
  ]);
  try {
    const res = await fetchWithBackoff("http://x", {}, { baseMs: 1, capMs: 2, maxAttempts: 4 });
    assertEquals(res.attempts, 1);
    assertEquals(res.response!.status, 402);
    assertEquals(f.calls.length, 1);
    await res.response!.text();
  } finally {
    f.restore();
  }
});

Deno.test("fetchWithBackoff honors numeric retry-after seconds", async () => {
  const f = withFakeFetch([
    () => new Response("rl", { status: 429, headers: { "retry-after": "0" } }),
    () => new Response("ok", { status: 200 }),
  ]);
  const onRetry: Array<{ attempt: number; delayMs: number; retryAfterMs: number | null }> = [];
  try {
    const res = await fetchWithBackoff("http://x", {}, {
      baseMs: 1000, capMs: 8000, maxAttempts: 3,
      onRetry: (info) => { onRetry.push({ attempt: info.attempt, delayMs: info.delayMs, retryAfterMs: info.retryAfterMs }); },
    });
    assertEquals(res.response!.status, 200);
    assertEquals(onRetry.length, 1);
    assertEquals(onRetry[0].retryAfterMs, 0); // parsed from "0" seconds header
    await res.response!.text();
  } finally {
    f.restore();
  }
});

// Idempotency-key derivation: mirrors the rule used by write-article so the
// same story_id (or same client key) is guaranteed to map to the same key
// across retries — preventing duplicate articles being created.
function deriveIdempotencyKey({ clientKey, story_id, source_title, source_name }: {
  clientKey?: string; story_id?: string; source_title?: string; source_name?: string;
}): string {
  return (typeof clientKey === "string" && clientKey.trim()) ||
    (story_id ? `story:${story_id}` : `src:${(source_title || "").slice(0, 120)}:${(source_name || "")}`);
}

Deno.test("idempotency key: client-provided key wins", () => {
  const k = deriveIdempotencyKey({ clientKey: "wa:abc", story_id: "ignored" });
  assertEquals(k, "wa:abc");
});

Deno.test("idempotency key: story_id fallback is stable across retries", () => {
  const a = deriveIdempotencyKey({ story_id: "11111111-1111-1111-1111-111111111111" });
  const b = deriveIdempotencyKey({ story_id: "11111111-1111-1111-1111-111111111111" });
  assertEquals(a, b);
  assertEquals(a, "story:11111111-1111-1111-1111-111111111111");
});

Deno.test("idempotency key: source-derived fallback when no story_id", () => {
  const a = deriveIdempotencyKey({ source_title: "Headline", source_name: "wire" });
  const b = deriveIdempotencyKey({ source_title: "Headline", source_name: "wire" });
  assertEquals(a, b);
  assert(a.startsWith("src:Headline:wire"));
});