import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_latest_articles",
  title: "List latest articles",
  description:
    "List the most recently published Amaica Media articles, optionally filtered by category or region.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many articles to return (max 50)."),
    category: z
      .enum(["music", "film", "tv", "events", "celebrity", "culture", "Our Legends"])
      .optional()
      .describe("Filter by category."),
    region: z
      .enum(["western_kenya", "national"])
      .optional()
      .describe("Filter by region."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category, region }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    let q = supabase
      .from("drafts")
      .select("id, headline, lede, category, region, hero_image_url, published_at, byline")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (category) q = q.eq("category", category);
    if (region) q = q.eq("region", region);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { articles: data ?? [] },
    };
  },
});