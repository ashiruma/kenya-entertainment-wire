import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const stripped = String(text).replace(/<[^>]+>/g, " ");
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

// Very small English stemmer covering the suffixes that matter most for
// Kenyan entertainment queries (plurals, gerunds, past tense, comparatives).
// Deliberately conservative — no Porter — to avoid noisy false positives.
function stem(token: string): string {
  const t = token.toLowerCase();
  if (t.length <= 4) return t;
  const suffixes = ["iest", "iness", "ingly", "ing", "edly", "ed", "ies", "es", "ly", "s"];
  for (const suf of suffixes) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) {
      let base = t.slice(0, -suf.length);
      if (suf === "ies") base += "y";
      return base;
    }
  }
  return t;
}

// Parse a query into quoted phrases and bare tokens (with stems).
function parseQuery(query: string): { phrases: string[]; tokens: string[]; stems: string[] } {
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
    .slice(0, 8);
  const stems = Array.from(new Set(tokens.map(stem)));
  return { phrases: phrases.slice(0, 4), tokens, stems };
}

// Western Kenya counties/towns used to scope results beyond the region flag.
const WESTERN_KENYA_TERMS = [
  "western kenya", "kakamega", "kisumu", "bungoma", "busia", "vihiga",
  "siaya", "homa bay", "migori", "kisii", "nyamira", "trans nzoia",
  "uasin gishu", "eldoret", "nandi", "bomet", "kericho", "luhya",
  "luo", "kalenjin", "kisii", "nyanza", "rift valley",
];

// Strict ISO 8601 check. Zod's `.datetime()` runs before the handler and its
// errors surface as raw validation objects — we want a friendly MCP-facing
// message, so we accept plain strings and validate here.
type IsoResult = { ok: true; value: string | undefined; error?: undefined } | { ok: false; value?: undefined; error: string };
function parseIsoDate(value: string | undefined, field: string): IsoResult {
  if (value === undefined || value === null || value === "") return { ok: true, value: undefined };
  // Require a full ISO 8601 date-time with timezone or 'Z'.
  const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
  if (!isoRe.test(value)) {
    return {
      ok: false,
      error: `Invalid ${field}: '${value}'. Expected an ISO 8601 timestamp like '2025-01-31T09:00:00Z' or '2025-01-31T09:00:00+03:00'.`,
    };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Invalid ${field}: '${value}' is not a real calendar date.` };
  }
  return { ok: true, value: d.toISOString() };
}

// Build short highlighted snippets around the first occurrence of each match.
function buildSnippets(
  body: string,
  headline: string,
  lede: string,
  needles: string[],
  maxSnippets = 3,
  radius = 90,
): { field: "headline" | "lede" | "body"; match: string; text: string }[] {
  const out: { field: "headline" | "lede" | "body"; match: string; text: string }[] = [];
  const seen = new Set<string>();
  const sources: { field: "headline" | "lede" | "body"; text: string }[] = [
    { field: "headline", text: headline ?? "" },
    { field: "lede", text: lede ?? "" },
    { field: "body", text: (body ?? "").replace(/<[^>]+>/g, " ") },
  ];
  for (const needle of needles) {
    if (!needle) continue;
    const n = needle.toLowerCase();
    for (const src of sources) {
      if (out.length >= maxSnippets) break;
      const hay = src.text;
      const idx = hay.toLowerCase().indexOf(n);
      if (idx === -1) continue;
      const start = Math.max(0, idx - radius);
      const end = Math.min(hay.length, idx + needle.length + radius);
      let raw = hay.slice(start, end).replace(/\s+/g, " ").trim();
      // Mark the match with **…** so editors can spot it at a glance.
      const rel = raw.toLowerCase().indexOf(n);
      if (rel !== -1) {
        raw = raw.slice(0, rel) + "**" + raw.slice(rel, rel + needle.length) + "**" + raw.slice(rel + needle.length);
      }
      const key = `${src.field}:${raw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ field: src.field, match: needle, text: (start > 0 ? "…" : "") + raw + (end < hay.length ? "…" : "") });
      if (out.length >= maxSnippets) break;
    }
  }
  return out;
}

// Example queries surface in the MCP tool description so editors and agents
// see copy-pasteable calls for the most common Kenyan / Western Kenya beats.
const SEARCH_EXAMPLES = `

Examples:
- Western Kenya scoping with pagination:
  { "query": "kakamega bullfighting", "region_scope": "western_kenya", "limit": 10, "offset": 0 }
- Phrase match + Kenya-wide scope:
  { "query": "\\"luo festival\\" bongo", "region_scope": "kenya", "limit": 20 }
- Date-window filter for last month's national coverage:
  { "query": "afrobeats concert", "region_scope": "national", "start_date": "2025-06-01T00:00:00Z", "end_date": "2025-06-30T23:59:59Z" }
- Legends-only backlog with pagination:
  { "query": "ogada", "category": "Our Legends", "limit": 25, "offset": 25 }`;

export default defineTool({
  name: "search_articles",
  title: "Search articles",
  description:
    "Full-text search of published Amaica Media articles across headline, lede, and body. Supports quoted \"exact phrases\", basic English stemming (plurals, -ing, -ed), region scoping ('western_kenya' | 'kenya' | 'national' | 'world' | 'all'), category filter, published_at date window (start_date / end_date, ISO 8601), and pagination via limit + offset. Returns strict typed {results, count, total, limit, offset, has_more} with each result including {id, headline, lede, byline, category, region, status, hero_image_url, published_at, word_count, source_count, is_legend, match_score, snippets:[{field,match,text}]}." +
    SEARCH_EXAMPLES,
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .describe(
        "Keywords to search for across headline, lede, and body. Wrap exact phrases in double quotes (e.g. `\"nyanza festival\" bongo`). Bare tokens are also matched by simple stems (plurals, -ing, -ed).",
      ),
    region_scope: z
      .enum(["western_kenya", "kenya", "national", "world", "all"])
      .default("all")
      .describe(
        "Scope results by region. 'western_kenya' restricts to region='western_kenya' OR body/headline mentioning a Western Kenya county/town. 'kenya' includes both national and western_kenya rows. 'national' restricts to region='national'. 'world' restricts to international coverage (region='world'). 'all' returns everything.",
      ),
    category: z
      .enum(["music", "film", "tv", "events", "celebrity", "culture", "Our Legends"])
      .optional()
      .describe("Optional category filter."),
    start_date: z
      .string()
      .optional()
      .describe(
        "Only include articles with published_at >= this ISO 8601 timestamp (e.g. '2025-01-31T09:00:00Z'). Invalid values return a clear error.",
      ),
    end_date: z
      .string()
      .optional()
      .describe(
        "Only include articles with published_at <= this ISO 8601 timestamp (e.g. '2025-01-31T09:00:00Z'). Invalid values return a clear error.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Page size (max 50)."),
    offset: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .default(0)
      .describe("Number of results to skip for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, region_scope, category, start_date, end_date, limit, offset }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );

    const parsedStart = parseIsoDate(start_date, "start_date");
    if (!parsedStart.ok) return { content: [{ type: "text", text: parsedStart.error }], isError: true };
    const parsedEnd = parseIsoDate(end_date, "end_date");
    if (!parsedEnd.ok) return { content: [{ type: "text", text: parsedEnd.error }], isError: true };
    if (parsedStart.value && parsedEnd.value && parsedStart.value > parsedEnd.value) {
      return {
        content: [{ type: "text", text: `Invalid date window: start_date (${parsedStart.value}) is after end_date (${parsedEnd.value}).` }],
        isError: true,
      };
    }
    const startIso = parsedStart.value;
    const endIso = parsedEnd.value;

    const { phrases, tokens, stems } = parseQuery(query);
    if (phrases.length === 0 && tokens.length === 0) {
      return { content: [{ type: "text", text: "Query too short" }], isError: true };
    }

    // Build ilike OR clauses. Phrases match exactly; stems widen recall.
    const orClauses: string[] = [];
    const pushIlike = (needle: string) => {
      const esc = needle.replace(/[,()"]/g, "");
      if (!esc) return;
      orClauses.push(`headline.ilike.%${esc}%`);
      orClauses.push(`lede.ilike.%${esc}%`);
      orClauses.push(`body.ilike.%${esc}%`);
    };
    for (const p of phrases) pushIlike(p);
    for (const s of stems) pushIlike(s);

    let q = supabase
      .from("drafts")
      .select(
        "id, headline, lede, body, category, region, hero_image_url, published_at, byline, sources, status",
        { count: "exact" },
      )
      .eq("status", "published")
      .or(orClauses.join(","))
      .order("published_at", { ascending: false, nullsFirst: false });

    if (category) q = q.eq("category", category);
    if (startIso) q = q.gte("published_at", startIso);
    if (endIso) q = q.lte("published_at", endIso);
    if (region_scope === "national") q = q.eq("region", "national");
    else if (region_scope === "world") q = q.eq("region", "world");
    else if (region_scope === "kenya") q = q.in("region", ["national", "western_kenya"]);
    // western_kenya + all are filtered client-side below (western_kenya widens beyond the flag).

    // Overfetch so we can re-rank and apply the western_kenya text filter before paginating.
    const fetchCap = Math.min((offset + limit) * 3 + 30, 300);
    const { data, error, count } = await q.limit(fetchCap);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const lowerPhrases = phrases.map((p) => p.toLowerCase());
    const lowerTokens = tokens.map((t) => t.toLowerCase());
    const lowerStems = stems.map((s) => s.toLowerCase());
    const rows = (data ?? []).filter((d: any) => {
      if (region_scope !== "western_kenya") return true;
      if (d.region === "western_kenya") return true;
      const hay = `${d.headline ?? ""} ${d.lede ?? ""} ${d.body ?? ""}`.toLowerCase();
      return WESTERN_KENYA_TERMS.some((term) => hay.includes(term));
    });

    const scored = rows
      .map((d: any) => {
        const headline = (d.headline ?? "").toLowerCase();
        const lede = (d.lede ?? "").toLowerCase();
        const body = (d.body ?? "").toLowerCase();
        const hay = `${headline} ${lede} ${body}`;
        let score = 0;
        // Exact phrases weigh heaviest.
        for (const p of lowerPhrases) {
          if (headline.includes(p)) score += 15;
          if (lede.includes(p)) score += 9;
          const bodyMatches = body.split(p).length - 1;
          score += Math.min(bodyMatches, 5) * 2;
        }
        // Exact tokens.
        for (const t of lowerTokens) {
          if (headline.includes(t)) score += 5;
          if (lede.includes(t)) score += 3;
          const bodyMatches = hay.split(t).length - 1;
          score += Math.min(bodyMatches, 5);
        }
        // Stems (lower weight, only if not already an exact token).
        for (const s of lowerStems) {
          if (lowerTokens.includes(s)) continue;
          if (headline.includes(s)) score += 2;
          if (lede.includes(s)) score += 1;
          const bodyMatches = body.split(s).length - 1;
          score += Math.min(bodyMatches, 3) * 0.5;
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
          snippets: buildSnippets(
            d.body ?? "",
            d.headline ?? "",
            d.lede ?? "",
            // Prefer exact phrases, then tokens (skip stems already covered).
            [...phrases, ...tokens],
          ),
        };
      })
      .sort((a, b) => b.match_score - a.match_score);

    const paged = scored.slice(offset, offset + limit);
    const total = typeof count === "number" ? count : scored.length;
    const has_more = offset + paged.length < scored.length || (offset + limit) < total;

    return {
      content: [{ type: "text", text: JSON.stringify(paged) }],
      structuredContent: {
        query,
        region_scope,
        phrases,
        tokens,
        stems,
        start_date: startIso ?? null,
        end_date: endIso ?? null,
        limit,
        offset,
        count: paged.length,
        total,
        has_more,
        results: paged,
      },
    };
  },
});
