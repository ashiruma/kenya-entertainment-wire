import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// In-memory per-domain rate limiter (per edge instance).
const domainGate = new Map<string, { lastHit: number; minGapMs: number }>();
const DEFAULT_GAP_MS = 1500;
const MAX_GAP_MS = 60_000;

async function gateDomain(domain: string) {
  const now = Date.now();
  const g = domainGate.get(domain) || { lastHit: 0, minGapMs: DEFAULT_GAP_MS };
  const wait = g.lastHit + g.minGapMs - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 8000)));
  g.lastHit = Date.now();
  domainGate.set(domain, g);
}

function bumpBackoff(domain: string) {
  const g = domainGate.get(domain) || { lastHit: Date.now(), minGapMs: DEFAULT_GAP_MS };
  g.minGapMs = Math.min(MAX_GAP_MS, Math.max(DEFAULT_GAP_MS, g.minGapMs * 2));
  domainGate.set(domain, g);
}

function resetBackoff(domain: string) {
  domainGate.set(domain, { lastHit: Date.now(), minGapMs: DEFAULT_GAP_MS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let url = "";
  let story_id: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    url = body.url;
    story_id = body.story_id;
    if (!url) {
      return new Response(JSON.stringify({ success: false, fallback: true, error: "Missing url", content: "" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = getDomain(url);
    const fullDomain = (() => { try { return new URL(url).hostname; } catch { return ""; } })();

    // 1. Check blocklist BEFORE calling Firecrawl
    const { data: blocked } = await supabase
      .from("scrape_blocklist")
      .select("domain")
      .or(`domain.eq.${domain},domain.eq.${fullDomain}`)
      .maybeSingle();

    if (blocked) {
      console.log(`Blocklisted domain skipped: ${domain}`);
      await supabase.from("scrape_failures").upsert({
        source_url: url, domain, last_status_code: 0,
        last_error: "BLOCKLISTED", blocked: true,
        last_failed_at: new Date().toISOString(),
        fail_count: 1,
      }, { onConflict: "source_url" });
      await supabase.from("scrape_events").insert({
        source_url: url, domain, status_code: 0, success: false, error: "BLOCKLISTED",
      });
      return new Response(JSON.stringify({
        success: false, fallback: true, error: "DOMAIN_BLOCKLISTED", content: "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Per-domain backoff: respect next_retry_at if set
    const { data: existingFail } = await supabase
      .from("scrape_failures").select("fail_count, next_retry_at").eq("source_url", url).maybeSingle();
    if (existingFail?.next_retry_at && new Date(existingFail.next_retry_at) > new Date()) {
      return new Response(JSON.stringify({
        success: false, fallback: true, error: "BACKOFF_ACTIVE",
        retry_after: existingFail.next_retry_at, content: "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await gateDomain(domain);

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ success: false, fallback: true, error: "FIRECRAWL_NOT_CONFIGURED", content: "" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Call Firecrawl with timeout
    let fcRes: Response;
    try {
      fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (netErr) {
      console.warn(`Firecrawl network error for ${url}:`, netErr);
      bumpBackoff(domain);
      await supabase.from("scrape_failures").upsert({
        source_url: url, domain, last_status_code: 0,
        last_error: `NETWORK: ${netErr instanceof Error ? netErr.message : "unknown"}`,
        last_failed_at: new Date().toISOString(), fail_count: 1,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      }, { onConflict: "source_url" });
      await supabase.from("scrape_events").insert({
        source_url: url, domain, status_code: 0, success: false,
        error: netErr instanceof Error ? netErr.message.slice(0, 300) : "network",
      });
      return new Response(JSON.stringify({ success: false, fallback: true, error: "NETWORK_ERROR", content: "" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcData = await fcRes.json().catch(() => ({}));

    // 3. Handle non-OK responses gracefully (NEVER throw → never 500)
    if (!fcRes.ok) {
      const errMsg = fcData?.error || `HTTP_${fcRes.status}`;
      console.warn(`Firecrawl ${fcRes.status} for ${url}: ${String(errMsg).slice(0, 200)}`);

      // Auto-add to blocklist on 403 (unsupported site)
      if (fcRes.status === 403 && domain) {
        await supabase.from("scrape_blocklist").upsert(
          { domain, reason: `Auto-added: Firecrawl 403 for ${url.slice(0, 100)}` },
          { onConflict: "domain", ignoreDuplicates: true }
        );
      }

      // Bump exponential backoff on 429/5xx; longer cooldown on 403/402
      bumpBackoff(domain);
      const failCount = (existingFail?.fail_count || 0) + 1;
      const backoffMs =
        fcRes.status === 429 ? Math.min(15 * 60_000, 30_000 * 2 ** Math.min(failCount, 5)) :
        fcRes.status === 402 ? 60 * 60_000 :
        fcRes.status === 403 ? 24 * 60 * 60_000 :
        Math.min(10 * 60_000, 15_000 * 2 ** Math.min(failCount, 5));
      await supabase.from("scrape_failures").upsert({
        source_url: url, domain,
        last_status_code: fcRes.status,
        last_error: String(errMsg).slice(0, 500),
        fail_count: failCount,
        last_failed_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
        blocked: fcRes.status === 403,
      }, { onConflict: "source_url" });
      await supabase.from("scrape_events").insert({
        source_url: url, domain, status_code: fcRes.status, success: false,
        error: String(errMsg).slice(0, 300),
      });

      const errorCode =
        fcRes.status === 402 ? "CREDITS_EXHAUSTED" :
        fcRes.status === 403 ? "SOURCE_NOT_SUPPORTED" :
        fcRes.status === 429 ? "RATE_LIMITED" :
        `FIRECRAWL_${fcRes.status}`;

      return new Response(JSON.stringify({
        success: false, fallback: true, error: errorCode, status: fcRes.status, content: "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Success path
    const markdown: string = fcData.data?.markdown || fcData.markdown || "";
    const trimmed = markdown.slice(0, 8000);

    if (story_id) {
      await supabase.from("discovered_stories").update({ raw_content: trimmed }).eq("id", story_id);
    }

    resetBackoff(domain);
    // Record success
    await supabase.from("scrape_failures").upsert({
      source_url: url, domain,
      last_status_code: 200, last_error: null,
      last_success_at: new Date().toISOString(),
      next_retry_at: null,
      blocked: false, fail_count: 0,
    }, { onConflict: "source_url" });
    await supabase.from("scrape_events").insert({
      source_url: url, domain, status_code: 200, success: true, error: null,
    });

    return new Response(JSON.stringify({ success: true, content: trimmed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Last-resort catch — still return 200 so frontend never sees 500
    console.error("scrape-article unexpected error:", e);
    try {
      if (url) {
        await supabase.from("scrape_failures").upsert({
          source_url: url, domain: getDomain(url),
          last_status_code: 0,
          last_error: `UNCAUGHT: ${e instanceof Error ? e.message : "unknown"}`,
          last_failed_at: new Date().toISOString(), fail_count: 1,
        }, { onConflict: "source_url" });
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({
      success: false, fallback: true,
      error: e instanceof Error ? e.message : "Unknown error", content: "",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
