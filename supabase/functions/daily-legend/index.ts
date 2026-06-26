// Daily Our Legends generator: picks a legend, writes a tribute via Lovable AI,
// upserts today's legend_features row, and creates a newsroom draft for editorial.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function findImage(supabase: ReturnType<typeof createClient>, query: string): Promise<string | null> {
  try {
    const { data } = await supabase.functions.invoke("find-image", {
      body: { query, headline: query },
    });
    return data?.image?.url ?? null;
  } catch { return null; }
}

async function writeTribute(legend: Record<string, unknown>): Promise<{ headline: string; tribute: string } | null> {
  const sys = `You are Amaica Media's culture desk. Write a respectful, vivid 450-600 word tribute to an African entertainment legend, focused on their lasting impact on people. Use plain HTML paragraphs (<p>...</p>), no markdown. End with a single short pull-quote in <blockquote>.`;
  const user = `Legend: ${legend.name}
Country: ${legend.country}
Era: ${legend.era}
Field: ${legend.field}
Bio: ${legend.short_bio}
Impact: ${legend.impact}

Write a fresh tribute for today's "Our Legends" feature. Lead with their human impact, not just credits.`;

  const { fetchWithBackoff } = await import("../_shared/backoff.ts");
  const { response: res } = await fetchWithBackoff("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "publish_tribute",
          description: "Return the tribute fields",
          parameters: {
            type: "object",
            properties: {
              headline: { type: "string", description: "Punchy headline, max 90 chars" },
              tribute: { type: "string", description: "HTML body" },
            },
            required: ["headline", "tribute"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "publish_tribute" } },
    }),
  }, { maxAttempts: 4, baseMs: 1000, capMs: 8000 });
  if (!res || !res.ok) {
    console.error("AI error", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try { return JSON.parse(args); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // If today already done, return it (idempotent)
    const { data: existing } = await supabase
      .from("legend_features").select("*, legends(*)")
      .eq("feature_date", today).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, already: true, feature: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pick a legend not featured in the last 30 days
    const { data: recent } = await supabase
      .from("legend_features").select("legend_id")
      .gte("feature_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const exclude = new Set((recent || []).map((r) => r.legend_id));
    const { data: pool } = await supabase
      .from("legends").select("*").eq("active", true);
    const candidates = (pool || []).filter((l) => !exclude.has(l.id));
    const roster = candidates.length ? candidates : (pool || []);
    if (!roster.length) {
      return new Response(JSON.stringify({ success: false, error: "No legends in roster" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const legend = roster[Math.floor(Math.random() * roster.length)];

    const written = await writeTribute(legend as Record<string, unknown>);
    if (!written) {
      return new Response(JSON.stringify({ success: false, error: "AI failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const heroImage = legend.image_url || await findImage(supabase, `${legend.name} ${legend.field || ""}`);
    if (heroImage && !legend.image_url) {
      await supabase.from("legends").update({ image_url: heroImage }).eq("id", legend.id);
    }

    // Create newsroom draft for editorial review
    const { data: anyEditor } = await supabase
      .from("user_roles").select("user_id").in("role", ["editor", "admin"]).limit(1).maybeSingle();
    const authorId = anyEditor?.user_id;
    let draftId: string | null = null;
    if (authorId) {
      const { data: draft } = await supabase.from("drafts").insert({
        author_id: authorId,
        template_type: "feature",
        headline: written.headline,
        lede: `Our Legends · ${legend.name} (${legend.country})`,
        body: written.tribute,
        category: "Our Legends",
        region: "national",
        hero_image_url: heroImage,
        social_image_url: heroImage,
        byline: "Amaica Culture Desk",
        status: "draft",
      }).select("id").single();
      draftId = draft?.id ?? null;
    }

    const { data: feature, error: fErr } = await supabase.from("legend_features").insert({
      legend_id: legend.id,
      feature_date: today,
      headline: written.headline,
      tribute: written.tribute,
      hero_image_url: heroImage,
      draft_id: draftId,
    }).select().single();
    if (fErr) throw fErr;

    return new Response(JSON.stringify({ success: true, feature, legend, draft_id: draftId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("daily-legend error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});