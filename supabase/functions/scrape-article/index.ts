import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
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
      return new Response(JSON.stringify({
        success: false, fallback: true, error: "DOMAIN_BLOCKLISTED", content: "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
      await supabase.from("scrape_failures").upsert({
        source_url: url, domain, last_status_code: 0,
        last_error: `NETWORK: ${netErr instanceof Error ? netErr.message : "unknown"}`,
        last_failed_at: new Date().toISOString(), fail_count: 1,
      }, { onConflict: "source_url" });
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

      // Log failure (preserves last_success_at via upsert)
      const { data: existing } = await supabase
        .from("scrape_failures").select("fail_count").eq("source_url", url).maybeSingle();
      await supabase.from("scrape_failures").upsert({
        source_url: url, domain,
        last_status_code: fcRes.status,
        last_error: String(errMsg).slice(0, 500),
        fail_count: (existing?.fail_count || 0) + 1,
        last_failed_at: new Date().toISOString(),
        blocked: fcRes.status === 403,
      }, { onConflict: "source_url" });

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

    // Record success
    await supabase.from("scrape_failures").upsert({
      source_url: url, domain,
      last_status_code: 200, last_error: null,
      last_success_at: new Date().toISOString(),
      blocked: false, fail_count: 0,
    }, { onConflict: "source_url" });

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
