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
  name: "get_article",
  title: "Get article",
  description:
    "Fetch a published Amaica Media article by id. Returns a strict typed payload with headline, lede, body, byline, category, region, status, published_at, hero_image_url, word_count, sources (array of {url,title?,note?,section?}), and legend info when the article is an Our Legends feature.",
  inputSchema: {
    id: z.string().uuid().describe("The article id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("drafts")
      .select(
        "id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources, status, template_type, updated_at",
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Article not found" }], isError: true };

    const rawSources = Array.isArray(data.sources) ? (data.sources as any[]) : [];
    const sources = rawSources
      .map((s) => {
        if (typeof s === "string") return { url: s };
        if (s && typeof s === "object") {
          return {
            url: typeof s.url === "string" ? s.url : "",
            title: typeof s.title === "string" ? s.title : undefined,
            note: typeof s.note === "string" ? s.note : undefined,
            section: typeof s.section === "string" ? s.section : undefined,
          };
        }
        return { url: "" };
      })
      .filter((s) => s.url);

    let legend: { id: string; name: string; country: string | null } | null = null;
    if (data.category === "Our Legends") {
      const { data: lf } = await supabase
        .from("legend_features")
        .select("legend_id, legends:legend_id ( id, name, country )")
        .eq("draft_id", data.id)
        .maybeSingle();
      const l = (lf as any)?.legends;
      if (l) legend = { id: l.id, name: l.name, country: l.country ?? null };
    }

    const article = {
      id: data.id as string,
      headline: data.headline as string,
      lede: (data.lede ?? "") as string,
      body: (data.body ?? "") as string,
      byline: (data.byline ?? null) as string | null,
      category: (data.category ?? null) as string | null,
      region: (data.region ?? null) as string | null,
      status: data.status as string,
      template_type: (data.template_type ?? null) as string | null,
      hero_image_url: (data.hero_image_url ?? null) as string | null,
      published_at: (data.published_at ?? null) as string | null,
      updated_at: (data.updated_at ?? null) as string | null,
      word_count: countWords(data.body as string),
      sources,
      legend,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(article) }],
      structuredContent: { article },
    };
  },
});