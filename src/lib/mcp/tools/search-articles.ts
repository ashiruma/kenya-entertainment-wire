import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const stripped = String(text).replace(/<[^>]+>/g, " ");
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

// Western Kenya counties/towns used to scope results beyond the region flag.
const WESTERN_KENYA_TERMS = [
  "western kenya", "kakamega", "kisumu", "bungoma", "busia", "vihiga",
  "siaya", "homa bay", "migori", "kisii", "nyamira", "trans nzoia",
  "uasin gishu", "eldoret", "nandi", "bomet", "kericho", "luhya",
  "luo", "kalenjin", "kisii", "nyanza", "rift valley",
];

export default defineTool({
  name: "search_articles",
  title: "Search articles",
  description:
    "Full-text search of published Amaica Media articles by keywords across headline, lede, and body. Supports region scoping ('western_kenya', 'kenya', 'national', or 'all') so callers can focus on Western Kenya or broader Kenyan entertainment coverage. Returns a strict typed array of {id, headline, lede, byline, category, region, status, hero_image_url, published_at, word_count, source_count, is_legend, match_score}.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe("Keywords to search for (matched across headline, lede, and body)."),
    region_scope: z
      .enum(["western_kenya", "kenya", "national", "all"])
      .default("all")
      .describe(
        "Scope results by region. 'western_kenya' restricts to region='western_kenya' OR body/headline mentioning a Western Kenya county/town. 'kenya' includes both national and western_kenya rows. 'national' restricts to region='national'. 'all' returns everything.",
      ),
    category: z
      .enum(["music", "film", "tv", "events", "celebrity", "culture", "Our Legends"])
      .optional()
      .describe("Optional category filter."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum results to return (max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, region_scope, category, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );

    // Split query into keyword tokens for OR ilike matching.
    const tokens = query
      .split(/\s+/)
      .map((t) => t.replace(/[%_,()]/g, "").trim())
      .filter((t) => t.length >= 2)
      .slice(0, 6);
    if (tokens.length === 0) {
      return { content: [{ type: "text", text: "Query too short" }], isError: true };
    }

    const orClauses: string[] = [];
    for (const t of tokens) {
      const esc = t.replace(/"/g, "");
      orClauses.push(`headline.ilike.%${esc}%`);
      orClauses.push(`lede.ilike.%${esc}%`);
      orClauses.push(`body.ilike.%${esc}%`);
    }

    let q = supabase
      .from("drafts")
      .select("id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources, status")
      .eq("status", "published")
      .or(orClauses.join(","))
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit * 3, 150));

    if (category) q = q.eq("category", category);
    if (region_scope === "national") q = q.eq("region", "national");
    else if (region_scope === "kenya") q = q.in("region", ["national", "western_kenya"]);
    // western_kenya + all are filtered client-side below (western_kenya widens beyond the flag).

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const lowerTokens = tokens.map((t) => t.toLowerCase());
    const rows = (data ?? []).filter((d: any) => {
      if (region_scope !== "western_kenya") return true;
      if (d.region === "western_kenya") return true;
      const hay = `${d.headline ?? ""} ${d.lede ?? ""} ${d.body ?? ""}`.toLowerCase();
      return WESTERN_KENYA_TERMS.some((term) => hay.includes(term));
    });

    const scored = rows
      .map((d: any) => {
        const hay = `${d.headline ?? ""} ${d.lede ?? ""} ${d.body ?? ""}`.toLowerCase();
        let score = 0;
        for (const t of lowerTokens) {
          if ((d.headline ?? "").toLowerCase().includes(t)) score += 5;
          if ((d.lede ?? "").toLowerCase().includes(t)) score += 3;
          const bodyMatches = hay.split(t).length - 1;
          score += Math.min(bodyMatches, 5);
        }
        return {
          id: d.id as string,
          headline: d.headline as string,
          lede: (d.lede ?? "") as string,
          byline: (d.byline ?? null) as string | null,
          category: (d.category ?? null) as string | null,
          region: (d.region ?? null) as string | null,
          status: d.status as string,
          hero_image_url: (d.hero_image_url ?? null) as string | null,
          published_at: (d.published_at ?? null) as string | null,
          word_count: countWords(d.body),
          source_count: Array.isArray(d.sources) ? d.sources.length : 0,
          is_legend: d.category === "Our Legends",
          match_score: score,
        };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    return {
      content: [{ type: "text", text: JSON.stringify(scored) }],
      structuredContent: { query, region_scope, results: scored, count: scored.length },
    };
  },
});
