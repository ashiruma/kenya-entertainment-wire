// Cron-driven worker: finds drafts marked for auto-publish whose scheduled time has
// passed, and pushes them to WordPress as `pending` (editorial review).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("drafts")
    .select("id, headline, body, lede, byline, hero_image_url, category")
    .eq("auto_publish_enabled", true)
    .is("wordpress_post_id", null)
    .lte("auto_publish_at", nowIso)
    .limit(10);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; ok: boolean; error?: string; url?: string }> = [];

  for (const d of due || []) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/publish-wordpress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          headline: d.headline,
          body: d.body,
          lede: d.lede,
          byline: d.byline,
          hero_image_url: d.hero_image_url,
          category: d.category,
          status: "pending", // editorial review on WordPress
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);

      await supabase.from("drafts").update({
        wordpress_post_url: json.post_url,
        wordpress_post_id: String(json.post_id),
        wordpress_published_at: nowIso,
        wordpress_last_error: null,
        auto_publish_enabled: false,
      }).eq("id", d.id);

      results.push({ id: d.id, ok: true, url: json.post_url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await supabase.from("drafts").update({ wordpress_last_error: msg }).eq("id", d.id);
      results.push({ id: d.id, ok: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});