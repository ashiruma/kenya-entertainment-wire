import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const stripped = String(text).replace(/<[^>]+>/g, " ");
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

const WESTERN_KENYA_TERMS = [
  "western kenya", "kakamega", "kisumu", "bungoma", "busia", "vihiga",
  "siaya", "homa bay", "migori", "kisii", "nyamira", "trans nzoia",
  "uasin gishu", "eldoret", "nandi", "bomet", "kericho", "luhya",
  "luo", "kalenjin", "nyanza", "rift valley",
];

type IsoOk = { ok: true; iso: string; error?: undefined };
type IsoErr = { ok: false; iso?: undefined; error: string };
function parseIso(value: string, field: string): IsoOk | IsoErr {
  const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
  if (!isoRe.test(value)) {
    return { ok: false, error: `Invalid ${field}: '${value}'. Expected ISO 8601 like '2025-07-14T09:00:00Z'.` };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false, error: `Invalid ${field}: '${value}' is not a real date.` };
  return { ok: true, iso: d.toISOString() };
}

/**
 * Scheduled-poller companion to `search_articles`. Given a `last_checked`
 * timestamp, returns only articles published (or re-published) after it,
 * scoped by the same keyword + region filters. Designed to be called on a
 * cadence by an agent that keeps its own `last_checked` cursor.
 */
export default defineTool({
  name: "search_new_articles_since",
  title: "Search new articles since",
  description:
    "Return only published articles matching a keyword + region query that were published strictly after `last_checked` (ISO 8601). Intended for scheduled polling: call periodically with the timestamp of your previous run and persist `next_last_checked` from the response as the cursor for the next call. Returns strict typed {results, count, last_checked, next_last_checked, region_scope} where each result includes headline, lede, byline, category, region, hero_image_url, published_at, word_count, source_count, is_legend, and match_score.\n\nExamples:\n- Poll every 15 minutes for new Western Kenya music stories:\n  { \"query\": \"music\", \"region_scope\": \"western_kenya\", \"last_checked\": \"2025-07-14T08:00:00Z\", \"limit\": 25 }\n- Watch a phrase across Kenya:\n  { \"query\": \"\\\"afrobeats concert\\\"\", \"region_scope\": \"kenya\", \"last_checked\": \"2025-07-13T00:00:00Z\" }",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe("Keywords or quoted phrases to match against headline/lede/body."),
    last_checked: z
      .string()
      .describe(
        "ISO 8601 timestamp cursor. Only articles with published_at > this value are returned. Invalid values return a clear error.",
      ),
    region_scope: z
      .enum(["western_kenya", "kenya", "national", "world", "all"])
      .default("all")
      .describe("Same semantics as search_articles.region_scope."),
    category: z
      .enum(["music", "film", "tv", "events", "celebrity", "culture", "Our Legends"])
      .optional()
      .describe("Optional category filter."),
    limit: z.number().int().min(1).max(50).default(25).describe("Max new articles to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ query, last_checked, region_scope, category, limit }) => {
    const parsed = parseIso(last_checked, "last_checked");
    if (!parsed.ok) return { content: [{ type: "text", text: parsed.error }], isError: true };
    const cursor = parsed.iso;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );

    // Parse query into phrases + tokens for ilike matching.
    const phrases: string[] = [];
    let rest = query;
    const phraseRe = /"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = phraseRe.exec(query)) !== null) {
      const p = m[1].trim();
      if (p.length >= 2) phrases.push(p);
    }
    rest = rest.replace(phraseRe, " ");
    const tokens = rest
      .split(/\s+/)
      .map((t) => t.replace(/[%_,()"]/g, "").trim())
      .filter((t) => t.length >= 2)
      .slice(0, 6);

    if (phrases.length === 0 && tokens.length === 0) {
      return { content: [{ type: "text", text: "Query too short" }], isError: true };
    }

    const orClauses: string[] = [];
    for (const needle of [...phrases, ...tokens]) {
      const esc = needle.replace(/[,()"]/g, "");
      if (!esc) continue;
      orClauses.push(`headline.ilike.%${esc}%`);
      orClauses.push(`lede.ilike.%${esc}%`);
      orClauses.push(`body.ilike.%${esc}%`);
    }

    let q = supabase
      .from("drafts")
      .select("id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources, status")
      .eq("status", "published")
      .gt("published_at", cursor)
      .or(orClauses.join(","))
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit * 3 + 20, 200));

    if (category) q = q.eq("category", category);
    if (region_scope === "national") q = q.eq("region", "national");
    else if (region_scope === "kenya") q = q.in("region", ["national", "western_kenya"]);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).filter((d: any) => {
      if (region_scope !== "western_kenya") return true;
      if (d.region === "western_kenya") return true;
      const hay = `${d.headline ?? ""} ${d.lede ?? ""} ${d.body ?? ""}`.toLowerCase();
      return WESTERN_KENYA_TERMS.some((t) => hay.includes(t));
    });

    const lowerPhrases = phrases.map((p) => p.toLowerCase());
    const lowerTokens = tokens.map((t) => t.toLowerCase());
    const scored = rows.map((d: any) => {
      const headline = (d.headline ?? "").toLowerCase();
      const lede = (d.lede ?? "").toLowerCase();
      const body = (d.body ?? "").toLowerCase();
      let score = 0;
      for (const p of lowerPhrases) {
        if (headline.includes(p)) score += 15;
        if (lede.includes(p)) score += 9;
        if (body.includes(p)) score += 3;
      }
      for (const t of lowerTokens) {
        if (headline.includes(t)) score += 5;
        if (lede.includes(t)) score += 3;
        if (body.includes(t)) score += 1;
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
    });

    const results = scored
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
      .slice(0, limit);

    // Next cursor: newest published_at we returned, else the input cursor.
    const nextCursor =
      results.reduce<string | null>((acc, r) => {
        if (!r.published_at) return acc;
        return acc && acc > r.published_at ? acc : r.published_at;
      }, null) ?? cursor;

    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      structuredContent: {
        query,
        region_scope,
        last_checked: cursor,
        next_last_checked: nextCursor,
        count: results.length,
        results,
      },
    };
  },
});