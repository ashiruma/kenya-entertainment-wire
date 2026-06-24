// Discover entertainment news from DB-managed feeds + Firecrawl search queries
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WESTERN_KENYA_KEYWORDS = [
  "kakamega", "kisumu", "bungoma", "vihiga", "busia", "siaya", "homa bay", "migori",
  "western kenya", "nyanza", "luhya", "luo", "kisii", "mumias", "webuye", "malava",
  "butere", "mbale", "kapsabet", "eldoret", "kitale", "nandi", "trans nzoia",
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : null;
}

function pickImage(xml: string): string | null {
  // Try common patterns
  const m1 = xml.match(/<media:content[^>]+url="([^"]+)"/i);
  if (m1) return m1[1];
  const m2 = xml.match(/<enclosure[^>]+url="([^"]+)"/i);
  if (m2) return m2[1];
  const m3 = xml.match(/<img[^>]+src="([^"]+)"/i);
  if (m3) return m3[1];
  return null;
}

function detectRegion(text: string): string {
  const lower = text.toLowerCase();
  return WESTERN_KENYA_KEYWORDS.some((k) => lower.includes(k)) ? "western_kenya" : "national";
}

async function fetchFeed(url: string, source: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AmaicaBot/1.0; +https://amaica.media)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    return itemBlocks.slice(0, 25).map((block) => {
      const title = stripTags(pick(block, "title") || "");
      const link = (pick(block, "link") || block.match(/<link[^>]+href="([^"]+)"/i)?.[1] || "").trim();
      const desc = stripTags(pick(block, "description") || pick(block, "summary") || pick(block, "content:encoded") || "");
      const pub = pick(block, "pubDate") || pick(block, "published") || pick(block, "updated");
      const image = pickImage(block);
      const author = stripTags(
        pick(block, "dc:creator") || pick(block, "author") || pick(block, "creator") || ""
      ) || null;
      const blob = `${title} ${desc}`;
      return {
        title,
        source,
        source_url: link,
        excerpt: desc.slice(0, 400),
        image_url: image,
        author,
        category: "entertainment",
        region: detectRegion(blob),
        published_at: pub ? new Date(pub).toISOString() : null,
      };
    }).filter((i) => i.title && i.source_url);
  } catch (e) {
    console.error(`Feed error ${url}:`, e);
    return [];
  }
}

// Optional: enrich with Firecrawl web search (time-filtered, last 24h) for fresh stories
async function firecrawlSearch(query: string): Promise<Array<{
  title: string; source: string; source_url: string; excerpt: string;
  image_url: string | null; category: string; region: string; published_at: string | null;
}>> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 10, lang: "en", country: "ke", tbs: "qdr:d" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn("Firecrawl search failed:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const json = await res.json();
    const results = json.data?.web ?? json.data ?? json.web ?? [];
    return (Array.isArray(results) ? results : []).map((r: { url?: string; title?: string; description?: string }) => {
      const title = stripTags(r.title || "");
      const excerpt = stripTags(r.description || "").slice(0, 400);
      const url = r.url || "";
      const blob = `${title} ${excerpt} ${query}`;
      let host = "Web";
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
      return {
        title, source: host, source_url: url, excerpt, image_url: null,
        category: "entertainment", region: detectRegion(blob), published_at: null,
      };
    }).filter((i) => i.title && i.source_url);
  } catch (e) {
    console.warn("Firecrawl error:", e);
    return [];
  }
}

// Normalize a title for dedup: lowercase, drop punctuation/numbers, collapse spaces, take first ~80 chars
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
async function sha1(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function extractHighlights(text: string): string[] {
  if (!text) return [];
  const sents = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 280);
  return sents.slice(0, 4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Parse trigger source
  let trigger = "manual";
  try { const body = await req.json(); if (body?.trigger) trigger = String(body.trigger); } catch { /* no body */ }

  // Overlap guard: refuse if another run started in the last 10 minutes and is still "running"
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from("discovery_runs")
    .select("id, started_at")
    .eq("status", "running")
    .gte("started_at", tenMinAgo)
    .limit(1);
  if (active && active.length > 0) {
    return new Response(
      JSON.stringify({ success: false, skipped: true, reason: "another_run_in_progress", run_id: active[0].id }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Open run
  const { data: runRow, error: runErr } = await supabase
    .from("discovery_runs")
    .insert({ trigger, status: "running" })
    .select()
    .single();
  if (runErr) {
    return new Response(JSON.stringify({ success: false, error: runErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const runId = runRow.id as string;
  const errors: Array<{ feed_id?: string; name: string; error: string }> = [];
  const feedStats: Array<{ feed_id: string; name: string; fetched: number; accepted: number; rejected: number; duplicates: number }> = [];

  try {
    // Load enabled feeds & queries
    const { data: feeds, error: fErr } = await supabase
      .from("discovery_feeds").select("*").eq("enabled", true);
    if (fErr) throw fErr;
    const rssFeeds = (feeds || []).filter((f) => f.kind === "rss" && f.url);
    const queryFeeds = (feeds || []).filter((f) => f.kind === "query" && f.query);

    type Item = {
      title: string; source: string; source_url: string; excerpt: string;
      image_url: string | null; author?: string | null;
      category: string; region: string; published_at: string | null;
      feed_id: string;
    };

    const rssResults = await Promise.all(rssFeeds.map(async (f) => {
      try {
        const items = await fetchFeed(f.url!, f.name);
        return { feed: f, items: items.map((i) => ({ ...i, feed_id: f.id })) as Item[], error: null as string | null };
      } catch (e) {
        return { feed: f, items: [] as Item[], error: e instanceof Error ? e.message : String(e) };
      }
    }));
    const searchResults = await Promise.all(queryFeeds.map(async (f) => {
      try {
        const items = await firecrawlSearch(f.query!);
        return { feed: f, items: items.map((i) => ({ ...i, feed_id: f.id })) as Item[], error: null as string | null };
      } catch (e) {
        return { feed: f, items: [] as Item[], error: e instanceof Error ? e.message : String(e) };
      }
    }));
    const allResults = [...rssResults, ...searchResults];

    const ent = /(music|song|album|artist|concert|festival|film|movie|tv|drama|celeb|actor|actress|singer|rapper|dj|netflix|show|premiere|award|nomin|tour|gospel|gengetone|bongo|afrobeat|comedy|comedian|podcast|tiktok|youtube|fashion|culture|nightlife|club|dance|theatre|theater|play|sauti|nyashinski|khaligraph|bahati|otile|sde|mpasho)/i;
    const politicsBlock = /(politic|election|parliament|senate|senator|mp\b|governor|president|ruto|raila|uhuru|kenyatta|odinga|cabinet|ministry|minister|impeach|bill\s|county\s+assembly|azimio|kenya\s+kwanza|udaa?|orange\s+democratic|wiper|jubilee|ford\s+kenya|protest|maandamano|gen[\s-]?z\s+protest|ethnic|tribal|war|terror|al[-\s]?shabaab|coup|sanction|diplomat|treaty|geopolit|military|army\s|police\s+kill|murder|assassinat|corruption|graft|scandal|court\s+case|judge|judiciary|supreme\s+court|high\s+court|kdf|nis\b|dci\b|ipoa)/i;

    let fetchedCount = 0, insertedCount = 0, duplicateCount = 0, rejectedCount = 0, filteredCount = 0;
    const seenHash = new Set<string>();

    for (const r of allResults) {
      const stats = { feed_id: r.feed.id as string, name: r.feed.name as string, fetched: r.items.length, accepted: 0, rejected: 0, duplicates: 0 };
      fetchedCount += r.items.length;
      if (r.error) {
        errors.push({ feed_id: r.feed.id, name: r.feed.name, error: r.error });
        await supabase.from("discovery_feeds").update({
          last_fetched_at: new Date().toISOString(),
          last_status: "error",
          last_error: r.error.slice(0, 500),
          last_item_count: 0,
        }).eq("id", r.feed.id);
        feedStats.push(stats);
        continue;
      }

      for (const item of r.items) {
        const blob = `${item.title} ${item.excerpt}`;
        let reason: string | null = null;
        if (politicsBlock.test(blob)) reason = "politics_or_hard_news";
        else if (!(ent.test(blob) || /entertainment|sde|buzz|pulse|mpasho|ghafla|capital/i.test(item.source))) reason = "non_entertainment";

        const hash = await sha1(`${normalizeTitle(item.title)}|${hostOf(item.source_url)}`);
        if (seenHash.has(hash)) {
          stats.duplicates++; duplicateCount++; continue;
        }
        seenHash.add(hash);

        if (reason) {
          // Record rejection (best-effort) — still try to dedup-insert so analytics has data
          const { error: insErr } = await supabase.from("discovered_stories").insert({
            ...item, dedupe_hash: hash, status: "rejected", rejection_reason: reason,
            highlights: extractHighlights(item.excerpt),
          });
          if (!insErr) { stats.rejected++; rejectedCount++; }
          else if (insErr.code === "23505") { stats.duplicates++; duplicateCount++; }
          continue;
        }

        const { error: insErr } = await supabase.from("discovered_stories").insert({
          ...item, dedupe_hash: hash, status: "new",
          highlights: extractHighlights(item.excerpt),
          preview_summary: item.excerpt?.slice(0, 280) || null,
        });
        if (!insErr) { stats.accepted++; insertedCount++; filteredCount++; }
        else if (insErr.code === "23505") { stats.duplicates++; duplicateCount++; }
        else errors.push({ feed_id: r.feed.id, name: r.feed.name, error: insErr.message });
      }

      await supabase.from("discovery_feeds").update({
        last_fetched_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        last_item_count: r.items.length,
        total_accepted: (r.feed.total_accepted ?? 0) + stats.accepted,
        total_rejected: (r.feed.total_rejected ?? 0) + stats.rejected,
        total_duplicates: (r.feed.total_duplicates ?? 0) + stats.duplicates,
      }).eq("id", r.feed.id);
      feedStats.push(stats);
    }

    const finalStatus = errors.length === 0 ? "success" : (insertedCount > 0 ? "partial" : "failed");
    await supabase.from("discovery_runs").update({
      finished_at: new Date().toISOString(),
      status: finalStatus,
      fetched_count: fetchedCount,
      filtered_count: filteredCount,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      rejected_count: rejectedCount,
      errors, feed_stats: feedStats,
    }).eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true, run_id: runId, status: finalStatus,
        fetched: fetchedCount, inserted: insertedCount,
        duplicates: duplicateCount, rejected: rejectedCount, errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await supabase.from("discovery_runs").update({
      finished_at: new Date().toISOString(), status: "failed",
      errors: [...errors, { name: "run", error: msg }], feed_stats: feedStats,
    }).eq("id", runId);
    return new Response(JSON.stringify({ success: false, run_id: runId, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});