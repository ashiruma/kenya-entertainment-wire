import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const { story_id, url } = await req.json();
    if (!url) throw new Error("Missing url");

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const fcData = await fcRes.json().catch(() => ({}));
    if (!fcRes.ok) {
      if (fcRes.status === 402) {
        return new Response(JSON.stringify({ success: false, fallback: true, error: "Firecrawl credits exhausted. Please top up at firecrawl.dev.", content: "" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Site unsupported / blocked / rate-limited — fall back gracefully so the writer can use RSS excerpt
      console.warn(`Firecrawl ${fcRes.status} for ${url}:`, JSON.stringify(fcData).slice(0, 300));
      return new Response(JSON.stringify({
        success: false,
        fallback: true,
        error: fcRes.status === 403 ? "SOURCE_NOT_SUPPORTED" : `FIRECRAWL_${fcRes.status}`,
        content: "",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const markdown: string = fcData.data?.markdown || fcData.markdown || "";
    const trimmed = markdown.slice(0, 8000);

    if (story_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("discovered_stories").update({ raw_content: trimmed }).eq("id", story_id);
    }

    return new Response(JSON.stringify({ success: true, content: trimmed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scrape-article error:", e);
    return new Response(
      JSON.stringify({ success: false, fallback: true, error: e instanceof Error ? e.message : "Unknown error", content: "" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});