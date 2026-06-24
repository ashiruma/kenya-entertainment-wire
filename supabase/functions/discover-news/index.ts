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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all RSS feeds + Firecrawl search queries in parallel
    const SEARCH_QUERIES = [
      "Kenya entertainment celebrity news today -politics -election",
      "Western Kenya music event Kakamega Kisumu Bungoma concert",
      "Kenyan celebrity gossip showbiz this week",
      "Kenyan new music release song album",
      "Luhya Luo artist musician Kenya",
      "Kenya film TV show Netflix premiere",
      "Nairobi nightlife festival lineup",
      "Kenyan comedian podcast TikTok trending",
      "Gengetone Bongo Afrobeats new release Kenya",
      "East Africa music tour Uganda Tanzania Rwanda concert",
      "African entertainment legend tribute biopic documentary",
      "Kisumu Kakamega Bungoma Eldoret event festival lineup",
      "Kenyan Luhya gospel benga ohangla new song",
      "Showmax Netflix Africa premiere Kenyan cast",
      "Diamond Platnumz Sauti Sol Nyashinski Khaligraph new",
      "Kenyan fashion designer red carpet awards",
      "African film festival award winner Kenya nomination",
      "Kenyan influencer YouTuber TikTok viral video",
      "Luo Luhya Kalenjin wedding traditional music star",
      "Western Kenya theatre play performance Kakamega Kisumu",
      "Kenya DJ producer beat single drop release",
    ];
    const [rss, search] = await Promise.all([
      Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source))).then((r) => r.flat()),
      Promise.all(SEARCH_QUERIES.map((q) => firecrawlSearch(q))).then((r) => r.flat()),
    ]);
    const items = [...rss, ...search];

    // Filter to entertainment-ish keywords (very loose) and de-dupe
    const ent = /(music|song|album|artist|concert|festival|film|movie|tv|drama|celeb|actor|actress|singer|rapper|dj|netflix|show|premiere|award|nomin|tour|gospel|gengetone|bongo|afrobeat|comedy|comedian|podcast|tiktok|youtube|fashion|culture|nightlife|club|dance|theatre|theater|play|sauti|nyashinski|khaligraph|bahati|otile|sde|mpasho)/i;
    // Hard exclude politics, hard news, crime, business/finance noise
    const politicsBlock = /(politic|election|parliament|senate|senator|mp\b|governor|president|ruto|raila|uhuru|kenyatta|odinga|cabinet|ministry|minister|impeach|bill\s|county\s+assembly|azimio|kenya\s+kwanza|udaa?|orange\s+democratic|wiper|jubilee|ford\s+kenya|protest|maandamano|gen[\s-]?z\s+protest|ethnic|tribal|war|terror|al[-\s]?shabaab|coup|sanction|diplomat|treaty|geopolit|military|army\s|police\s+kill|murder|assassinat|corruption|graft|scandal|court\s+case|judge|judiciary|supreme\s+court|high\s+court|kdf|nis\b|dci\b|ipoa)/i;
    const seen = new Set<string>();
    const filtered = items.filter((i) => {
      if (seen.has(i.source_url)) return false;
      seen.add(i.source_url);
      const blob = `${i.title} ${i.excerpt}`;
      if (politicsBlock.test(blob)) return false;
      const looksEntertainment = ent.test(blob) || /entertainment|sde|buzz|pulse|mpasho|ghafla|capital/i.test(i.source);
      return looksEntertainment;
    });

    // Sort: Western Kenya first, then by date
    filtered.sort((a, b) => {
      if (a.region !== b.region) return a.region === "western_kenya" ? -1 : 1;
      const da = a.published_at ? new Date(a.published_at).getTime() : 0;
      const db = b.published_at ? new Date(b.published_at).getTime() : 0;
      return db - da;
    });

    const top = filtered.slice(0, 40);

    // Upsert (ignore duplicates via unique source_url)
    let inserted = 0;
    for (const item of top) {
      const { error } = await supabase
        .from("discovered_stories")
        .insert(item);
      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: items.length, filtered: filtered.length, inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("discover-news error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});