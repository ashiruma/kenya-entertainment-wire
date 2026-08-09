import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "../supabase";
import { z } from "zod";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const stripped = String(text).replace(/<[^>]+>/g, " ");
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export default defineTool({
  name: "list_latest_articles",
  title: "List latest articles",
  description:
    "List the most recently published Amaica Media articles, optionally filtered by category or region. Returns a strict typed array of {id, headline, lede, byline, category, region, status, hero_image_url, published_at, word_count, source_count, is_legend}.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many articles to return (max 50)."),
    category: z
      .enum(["music", "film", "tv", "events", "celebrity", "culture", "Our Legends"])
      .optional()
      .describe("Filter by category."),
    region: z
      .enum(["western_kenya", "national", "world"])
      .optional()
      .describe("Filter by region."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category, region }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("drafts")
      .select("id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources, status")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (category) q = q.eq("category", category);
    if (region) q = q.eq("region", region);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const articles = (data ?? []).map((d: any) => ({
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
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(articles) }],
      structuredContent: { articles },
    };
  },
});