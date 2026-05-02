// Test harness: verifies scrape-article NEVER returns HTTP 500.
// Run with: deno test --allow-net --allow-env supabase/functions/scrape-article-test/
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

const SAMPLES = [
  // Known-blocked / unsupported by Firecrawl
  "https://www.facebook.com/something/posts/123",
  "https://www.instagram.com/p/abc/",
  "https://x.com/someone/status/123",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  // Should work
  "https://www.pulselive.co.ke/entertainment",
  "https://www.standardmedia.co.ke/sports",
  // Garbage / 404
  "https://example.com/this-does-not-exist-xyz-12345",
  // Empty / invalid
  "",
];

async function callScrape(url: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-article`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON}`, "apikey": ANON },
    body: JSON.stringify({ url }),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* keep empty */ }
  return { status: res.status, json, text };
}

Deno.test("scrape-article never returns 500 across sample URLs", async () => {
  for (const url of SAMPLES) {
    const { status, json } = await callScrape(url);
    console.log(`[${status}] ${url.slice(0, 60)} → success=${json.success} fallback=${json.fallback} error=${json.error}`);
    assert(status !== 500, `URL ${url} returned HTTP 500`);
    assertEquals(status, 200, `URL ${url} should return 200, got ${status}`);
    assert("success" in json, `Response missing 'success' field for ${url}`);
    if (json.success === false) {
      assertEquals(json.fallback, true, `Failed scrape should set fallback=true for ${url}`);
    }
  }
});
